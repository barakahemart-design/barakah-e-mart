// =========================================================================
// SUPABASE CLIENT SERVICE MODULE FOR FLUTTER
// Manages complete transaction execution pipelines, profiles, and queries.
// =========================================================================

import 'package:supabase_flutter/supabase_flutter.dart';
import 'models.dart';

class SupabaseService {
  final SupabaseClient _client = Supabase.instance.client;

  // -------------------------------------------------------------
  // 1. AUTHENTICATION (Login, Register & Profiles)
  // -------------------------------------------------------------

  User? get currentUser => _client.auth.currentUser;

  /// Fetch profile for currently logged-in user, if any
  Future<UserProfile?> fetchCurrentUserProfile() async {
    final user = currentUser;
    if (user == null) return null;
    try {
      final Map<String, dynamic> rawProfile = await _client
          .from('profiles')
          .select()
          .eq('id', user.id)
          .single();
      return UserProfile.fromJson(rawProfile);
    } catch (_) {
      return null;
    }
  }

  /// Register user and automatically set defaults
  Future<UserProfile> registerUser({
    required String email,
    required String password,
    required String shopName,
    required String adminPasscode,
    required String salesPasscode,
  }) async {
    final String cleanEmail = email.trim().toLowerCase();
    final String cleanPassword = password.trim();

    final AuthResponse res = await _client.auth.signUp(
      email: cleanEmail,
      password: cleanPassword,
    );

    if (res.user == null) {
      throw Exception("Registration failed. Could not provision credentials.");
    }

    final String userId = res.user!.id;

    // Create a corresponding client profile in Supabase
    final profile = {
      'id': userId,
      'email': cleanEmail,
      'shop_name': shopName,
      'admin_passcode_hash': adminPasscode,
      'sales_passcode_hash': salesPasscode,
      'currency_symbol': '৳',
      'terms_conditions': '1. Warranty require original invoice.\n2. Replacement allowed within 7 days if unused.',
      'show_logo_in_invoice': true,
    };

    await _client.from('profiles').upsert(profile);

    return UserProfile.fromJson(profile);
  }

  /// Sign in via Email and Password
  Future<UserProfile> loginWithEmail({
    required String email,
    required String password,
  }) async {
    final String cleanEmail = email.trim().toLowerCase();
    final String cleanPassword = password.trim();

    final AuthResponse res = await _client.auth.signInWithPassword(
      email: cleanEmail,
      password: cleanPassword,
    );

    if (res.user == null) {
      throw Exception("Could not verify your credential profile.");
    }

    final Map<String, dynamic> rawProfile = await _client
        .from('profiles')
        .select()
        .eq('id', res.user!.id)
        .single();

    return UserProfile.fromJson(rawProfile);
  }

  /// Save dynamic invoice layout or shop info
  Future<void> saveUserProfile(UserProfile profile) async {
    await _client.from('profiles').update(profile.toJson()).eq('id', profile.id);
  }

  /// Sign out currently active session
  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Reset account or clean historical datasets
  Future<void> purgeUserData(String userId, {required bool deleteAccount}) async {
    if (deleteAccount) {
      // In production, deleting would invoke Supabase CLI Auth Admin deletion
      await _client.from('profiles').delete().eq('id', userId);
      await _client.auth.signOut();
    } else {
      // Clear data tables using the isolated user_id column
      await _client.from('expenses').delete().eq('user_id', userId);
      await _client.from('transaction_items').delete().eq('user_id', userId);
      await _client.from('transactions').delete().eq('user_id', userId);
      await _client.from('purchases').delete().eq('user_id', userId);
      await _client.from('customers').delete().eq('user_id', userId);
      // Delete products completely instead of resetting stocks to zero
      await _client.from('products').delete().eq('user_id', userId);
    }
  }

  // -------------------------------------------------------------
  // 2. PRODUCT MANAGEMENT (পণ্য তালিকা)
  // -------------------------------------------------------------

  Future<List<Product>> fetchProducts() async {
    final List<dynamic> records = await _client
        .from('products')
        .select()
        .eq('user_id', currentUser!.id)
        .order('name', ascending: true);
    return records.map((json) => Product.fromJson(json)).toList();
  }

  Future<Product> addProduct(Product product) async {
    final Map<String, dynamic> record = await _client
        .from('products')
        .insert({
          'owner_id': currentUser!.id,
          'user_id': currentUser!.id,
          'name': product.name,
          'sku': product.sku,
          'category': product.category,
          'buy_price': product.buyPrice,
          'sell_price': product.sellPrice,
          'stock': product.stock,
          'unit': product.unit,
          'image_url': product.imageUrl,
        })
        .select()
        .single();
    return Product.fromJson(record);
  }

  Future<void> updateProductPricesAndStock({
    required String productId,
    required double buyPrice,
    required double sellPrice,
    required double addedStock,
  }) async {
    // If added stock > 0, we fetch the current stock first
    if (addedStock != 0) {
      final oldProduct = await _client.from('products').select('stock').eq('id', productId).single();
      final double currentStock = (oldProduct['stock'] as num).toDouble();
      await _client.from('products').update({
        'buy_price': buyPrice,
        'sell_price': sellPrice,
        'stock': currentStock + addedStock,
      }).eq('id', productId);
    } else {
      await _client.from('products').update({
        'buy_price': buyPrice,
        'sell_price': sellPrice,
      }).eq('id', productId);
    }
  }

  Future<void> removeProduct(String id) async {
    await _client.from('products').delete().eq('id', id);
  }

  // -------------------------------------------------------------
  // 3. PURCHASES RESTOCK LEDGER (ক্রয় খতিয়ান)
  // -------------------------------------------------------------

  Future<List<Purchase>> fetchPurchases() async {
    final List<dynamic> records = await _client
        .from('purchases')
        .select()
        .eq('user_id', currentUser!.id)
        .order('created_at', ascending: false);
    return records.map((e) => Purchase.fromJson(e)).toList();
  }

  /// Inserts purchase and invokes Postgres Trigger to adjust product stocks and negative profits
  Future<void> writePurchaseBill(Purchase pur) async {
    await _client.from('purchases').insert({
      'owner_id': currentUser!.id,
      'user_id': currentUser!.id,
      'invoice_no': pur.invoiceNo,
      'product_id': pur.productId,
      'quantity': pur.quantity,
      'buy_price': pur.buyPrice,
    });
  }

  /// Edit existing purchase cost. If buy price is corrected, trigger automatically recalculates
  /// affected negative sale invoices profits.
  Future<void> updatePurchaseCost(String purchaseId, double updatedBuyPrice) async {
    await _client.from('purchases').update({
      'buy_price': updatedBuyPrice,
    }).eq('id', purchaseId);
  }

  Future<void> deletePurchaseBill(String id) async {
    // Requires inventory stock adjustment
    final oldBill = await _client.from('purchases').select().eq('id', id).single();
    final double quantity = (oldBill['quantity'] as num).toDouble();
    final String productId = oldBill['product_id'];

    // Adjust physical stock backward
    final product = await _client.from('products').select('stock').eq('id', productId).single();
    final double currentStock = (product['stock'] as num).toDouble();

    await _client.from('products').update({'stock': currentStock - quantity}).eq('id', productId);
    await _client.from('purchases').delete().eq('id', id);
  }

  // -------------------------------------------------------------
  // 4. SALES CHECKOUT ENGINE (কাউন্টার ক্যাশ কাউন্টার)
  // -------------------------------------------------------------

  Future<List<OrderTransaction>> fetchSalesLedger() async {
    final List<dynamic> invoices = await _client
        .from('transactions')
        .select()
        .eq('user_id', currentUser!.id)
        .order('created_at', ascending: false);

    final List<OrderTransaction> result = [];
    for (var inv in invoices) {
      final List<dynamic> lineItems = await _client
          .from('transaction_items')
          .select()
          .eq('transaction_id', inv['id']);
      final items = lineItems.map((e) => TransactionItem.fromJson(e)).toList();
      result.add(OrderTransaction.fromJson(inv, items));
    }
    return result;
  }

  /// Complete Checkout transaction with negative stock logs
  Future<void> executeCheckout({
    required List<Map<String, dynamic>> cartItems,
    required double total,
    required double discount,
    required double vatRate,
    required double paid,
    required String method,
    required String invoiceNo,
    required String? customerId,
    required String? signatureBase64,
  }) async {
    final Map<String, dynamic> tx = await _client.from('transactions').insert({
      'owner_id': currentUser!.id,
      'user_id': currentUser!.id,
      'invoice_no': invoiceNo,
      'customer_id': customerId,
      'total_amount': total,
      'discount': discount,
      'vat_rate': vatRate,
      'paid_amount': paid,
      'payment_method': method,
      'signature_svg': signatureBase64,
    }).select().single();

    final String txId = tx['id'];

    // Post items and adjust stocks
    for (var item in cartItems) {
      final Product prod = item['product'];
      final double qty = item['quantity'];
      final double selectedPrice = item['sell_price'];
      
      // Determine if check is negative stock sale
      final bool isNegative = prod.stock < qty;

      await _client.from('transaction_items').insert({
        'owner_id': currentUser!.id,
        'user_id': currentUser!.id,
        'transaction_id': txId,
        'product_id': prod.id,
        'quantity': qty,
        'sell_price': selectedPrice,
        'cost_price': prod.buyPrice, // Save latest buy price as base cost
        'is_negative_sale': isNegative,
      });

      // Update physical product inventory stock levels
      await _client.from('products').update({
        'stock': prod.stock - qty,
      }).eq('id', prod.id);
    }
  }

  Future<void> deleteSaleMemo(OrderTransaction tx) async {
    // Adjust stocks back to positive
    for (var item in tx.items) {
      final prodSec = await _client.from('products').select('stock').eq('id', item.productId).single();
      final double stockNow = (prodSec['stock'] as num).toDouble();
      await _client.from('products').update({
        'stock': stockNow + item.quantity,
      }).eq('id', item.productId);
    }

    await _client.from('transaction_items').delete().eq('transaction_id', tx.id);
    await _client.from('transactions').delete().eq('id', tx.id);
  }

  // -------------------------------------------------------------
  // 5. CRM CUSTOMERS & OUTGOINGS (ব্যয় খতিয়ান)
  // -------------------------------------------------------------

  Future<List<Customer>> fetchCustomers() async {
    final List<dynamic> raw = await _client
        .from('customers')
        .select()
        .eq('user_id', currentUser!.id)
        .order('name');
    return raw.map((e) => Customer.fromJson(e)).toList();
  }

  Future<void> addCustomer(Customer client) async {
    await _client.from('customers').insert({
      'owner_id': currentUser!.id,
      'user_id': currentUser!.id,
      'name': client.name,
      'phone': client.phone,
      'address': client.address,
    });
  }

  Future<List<Expense>> fetchExpenses() async {
    final List<dynamic> raw = await _client
        .from('expenses')
        .select()
        .eq('user_id', currentUser!.id)
        .order('created_at', ascending: false);
    return raw.map((e) => Expense.fromJson(e)).toList();
  }

  Future<void> logExpense(Expense exp) async {
    await _client.from('expenses').insert({
      'owner_id': currentUser!.id,
      'user_id': currentUser!.id,
      'description': exp.description,
      'category': exp.category,
      'amount': exp.amount,
    });
  }

  Future<void> deleteExpense(String id) async {
    await _client.from('expenses').delete().eq('id', id);
  }

  // -------------------------------------------------------------
  // 6. REAL-TIME MULTI-FILTER REPORT AGGREGATES
  // -------------------------------------------------------------

  Future<Map<String, double>> queryDynamicPnLSummary() async {
    try {
      final List<dynamic> data = await _client
          .from('view_financial_overview')
          .select()
          .eq('owner_id', currentUser!.id);

      if (data.isEmpty) {
        return {'sales': 0.0, 'cogs': 0.0, 'discounts': 0.0, 'expenses': 0.0, 'net_profit': 0.0};
      }

      final row = data.first;
      return {
        'sales': (row['raw_sales'] ?? 0.0).toDouble(),
        'cogs': (row['total_cogs'] ?? 0.0).toDouble(),
        'discounts': (row['total_discounts'] ?? 0.0).toDouble(),
        'expenses': (row['total_expenses'] ?? 0.0).toDouble(),
        'net_profit': (row['net_profit'] ?? 0.0).toDouble(),
      };
    } catch (e) {
      return {'sales': 0.0, 'cogs': 0.0, 'discounts': 0.0, 'expenses': 0.0, 'net_profit': 0.0};
    }
  }

  // -------------------------------------------------------------
  // 7. REAL-TIME STREAMING INTEGRATION (Real-time Stream Engine)
  // -------------------------------------------------------------

  /// Stream of Products (Inventory) - Realtime enabled
  Stream<List<Product>> productsStream() {
    return _client
        .from('products')
        .stream(primaryKey: ['id'])
        .eq('user_id', currentUser!.id)
        .map((records) => records.map((json) => Product.fromJson(json)).toList());
  }

  /// Stream of Purchases
  Stream<List<Purchase>> purchasesStream() {
    return _client
        .from('purchases')
        .stream(primaryKey: ['id'])
        .eq('user_id', currentUser!.id)
        .map((records) => records.map((json) => Purchase.fromJson(json)).toList());
  }

  /// Stream of Customers
  Stream<List<Customer>> customersStream() {
    return _client
        .from('customers')
        .stream(primaryKey: ['id'])
        .eq('user_id', currentUser!.id)
        .map((records) => records.map((json) => Customer.fromJson(json)).toList());
  }

  /// Stream of Expenses
  Stream<List<Expense>> expensesStream() {
    return _client
        .from('expenses')
        .stream(primaryKey: ['id'])
        .eq('user_id', currentUser!.id)
        .map((records) => records.map((json) => Expense.fromJson(json)).toList());
  }

  /// Stream of Order Transactions (representing dynamic sales)
  /// Asynchronously joins transaction line items to build fully hydrated OrderTransaction models
  Stream<List<OrderTransaction>> transactionsStream() {
    return _client
        .from('transactions')
        .stream(primaryKey: ['id'])
        .eq('user_id', currentUser!.id)
        .asyncMap((invoices) async {
          final List<OrderTransaction> result = [];
          for (var inv in invoices) {
            try {
              final List<dynamic> lineItems = await _client
                  .from('transaction_items')
                  .select()
                  .eq('transaction_id', inv['id']);
              final items = lineItems.map((e) => TransactionItem.fromJson(e)).toList();
              result.add(OrderTransaction.fromJson(inv, items));
            } catch (_) {
              result.add(OrderTransaction.fromJson(inv, []));
            }
          }
          result.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          return result;
        });
  }
}
