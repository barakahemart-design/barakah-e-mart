// =========================================================================
// FIREBASE / EXPRESS REST PROXY SERVICE FOR FLUTTER
// Replaces Supabase pipelines to speak directly to the central Express DB server.
// Ensures 100% data parity between the laptop site and mobile phones.
// =========================================================================

import 'dart:convert';
import 'dart:io';
import 'dart:async';
import 'models.dart';

class MockUser {
  final String id;
  final String email;
  MockUser({required this.id, required this.email});
}

class SupabaseService {
  // Central Web Application Cloud Run Server Endpoint
  static final String _baseUrl = 'https://ais-pre-vddidihjmg7vkby5tsftb7-628989971621.asia-southeast1.run.app';
  static Map<String, dynamic>? _cachedSession;

  static Future<File> get _sessionFile async {
    final tempDir = Directory.systemTemp;
    return File('${tempDir.path}/barakah_session_firebase_v2.json');
  }

  static Future<void> _saveSession(String id, String email) async {
    _cachedSession = {'id': id, 'email': email};
    try {
      final file = await _sessionFile;
      await file.writeAsString(json.encode(_cachedSession));
    } catch (_) {}
  }

  static Future<void> _loadSession() async {
    if (_cachedSession != null) return;
    try {
      final file = await _sessionFile;
      if (await file.exists()) {
        final content = await file.readAsString();
        _cachedSession = json.decode(content);
      }
    } catch (_) {}
  }

  static Future<void> _clearSession() async {
    _cachedSession = null;
    try {
      final file = await _sessionFile;
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {}
  }

  MockUser? get currentUser {
    if (_cachedSession != null) {
      return MockUser(
        id: _cachedSession!['id'] ?? '',
        email: _cachedSession!['email'] ?? '',
      );
    }
    return null;
  }

  // Generic Rest HTTP Connection client request tunnel
  Future<dynamic> _makeRequest(String method, String path, {Map<String, dynamic>? body}) async {
    final client = HttpClient();
    client.badCertificateCallback = ((X509Certificate cert, String host, int port) => true);
    
    try {
      final uri = Uri.parse('$_baseUrl$path');
      HttpClientRequest request;
      if (method == 'POST') {
        request = await client.postUrl(uri);
        request.headers.set('content-type', 'application/json; charset=utf-8');
        if (body != null) {
          request.add(utf8.encode(json.encode(body)));
        }
      } else {
        request = await client.getUrl(uri);
      }
      
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (responseBody.isEmpty) return null;
        return json.decode(responseBody);
      } else {
        String errorMsg = 'HTTP ${response.statusCode} Error';
        try {
          final errorData = json.decode(responseBody);
          if (errorData is Map && errorData.containsKey('error')) {
            errorMsg = errorData['error'];
          }
        } catch (_) {}
        throw Exception(errorMsg);
      }
    } finally {
      client.close();
    }
  }

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & PROFILE CONTROL
  // -------------------------------------------------------------

  Future<UserProfile?> fetchCurrentUserProfile() async {
    await _loadSession();
    if (_cachedSession == null) return null;
    
    final userId = _cachedSession!['id'];
    try {
      final profilesList = await _makeRequest('GET', '/api/db/fetch?table=profiles&owner_email=$userId');
      if (profilesList != null && (profilesList as List).isNotEmpty) {
        return UserProfile.fromJson(Map<String, dynamic>.from(profilesList.first));
      }
    } catch (_) {}
    return null;
  }

  Future<UserProfile> registerUser({
    required String email,
    required String password,
    required String shopName,
    required String adminPasscode,
    required String salesPasscode,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    
    final res = await _makeRequest('POST', '/api/auth/signup', body: {
      'email': cleanEmail,
      'password': password,
    });
    
    if (res == null || res['user'] == null) {
      throw Exception("Registration failed. Please try again.");
    }
    
    final String userId = res['user']['id'] ?? res['user']['uid'] ?? 'gen_${DateTime.now().millisecondsSinceEpoch}';
    
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
    
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'profiles',
      'id': userId,
      'data': profile,
    });
    
    await _saveSession(userId, cleanEmail);
    return UserProfile.fromJson(profile);
  }

  Future<UserProfile> loginWithEmail({
    required String email,
    required String password,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    
    final res = await _makeRequest('POST', '/api/auth/signin', body: {
      'email': cleanEmail,
      'password': password,
    });
    
    if (res == null || res['user'] == null) {
      throw Exception("Could not verify your credential profile.");
    }
    
    final String userId = res['user']['id'] ?? res['user']['uid'] ?? '';
    
    final profilesList = await _makeRequest('GET', '/api/db/fetch?table=profiles&owner_email=$userId');
    
    Map<String, dynamic> rawProfile;
    if (profilesList != null && (profilesList as List).isNotEmpty) {
      rawProfile = Map<String, dynamic>.from(profilesList.first);
    } else {
      rawProfile = {
        'id': userId,
        'email': cleanEmail,
        'shop_name': 'Barakah Electronics',
        'admin_passcode_hash': '1234',
        'sales_passcode_hash': '5555',
        'currency_symbol': '৳',
        'terms_conditions': '1. Warranty require original invoice.\n2. Replacement allowed within 7 days if unused.',
        'show_logo_in_invoice': true,
      };
      await _makeRequest('POST', '/api/db/upsert', body: {
        'table': 'profiles',
        'id': userId,
        'data': rawProfile,
      });
    }
    
    await _saveSession(userId, cleanEmail);
    return UserProfile.fromJson(rawProfile);
  }

  Future<void> saveUserProfile(UserProfile profile) async {
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'profiles',
      'id': profile.id,
      'data': profile.toJson(),
    });
  }

  Future<void> signOut() async {
    await _clearSession();
  }

  Future<void> purgeUserData(String userId, {required bool deleteAccount}) async {
    if (deleteAccount) {
      await _makeRequest('POST', '/api/db/delete', body: {
        'table': 'profiles',
        'id': userId,
      });
      await signOut();
    } else {
      final collections = [
        'products',
        'customers',
        'purchases',
        'expenses',
        'transactions',
        'transaction_items'
      ];
      for (final table in collections) {
        try {
          final list = await _makeRequest('GET', '/api/db/fetch?table=$table&owner_email=$userId') ?? [];
          for (final record in list) {
            final id = record['id'];
            if (id != null) {
              await _makeRequest('POST', '/api/db/delete', body: {
                'table': table,
                'id': id,
              });
            }
          }
        } catch (_) {}
      }
    }
  }

  // -------------------------------------------------------------
  // 2. PRODUCT MANAGEMENT
  // -------------------------------------------------------------

  Future<List<Product>> fetchProducts() async {
    await _loadSession();
    if (_cachedSession == null) return [];
    final userId = _cachedSession!['id'];
    final list = await _makeRequest('GET', '/api/db/fetch?table=products&owner_email=$userId') ?? [];
    return (list as List).map((json) => Product.fromJson(Map<String, dynamic>.from(json))).toList();
  }

  Future<Product> addProduct(Product product) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    final id = product.id.isNotEmpty ? product.id : 'prod_${DateTime.now().millisecondsSinceEpoch}';
    
    final data = {
      'id': id,
      'owner_id': userId,
      'user_id': userId,
      'name': product.name,
      'sku': product.sku,
      'category': product.category,
      'buy_price': product.buyPrice,
      'sell_price': product.sellPrice,
      'stock': product.stock,
      'unit': product.unit,
      'image_url': product.imageUrl,
    };
    
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'products',
      'id': id,
      'data': data,
    });
    return Product.fromJson(data);
  }

  Future<void> updateProductPricesAndStock({
    required String productId,
    required double buyPrice,
    required double sellPrice,
    required double addedStock,
  }) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    
    final list = await _makeRequest('GET', '/api/db/fetch?table=products&owner_email=$userId') ?? [];
    final match = (list as List).firstWhere((p) => p['id'] == productId, orElse: () => null);
    
    if (match != null) {
      final oldStock = (match['stock'] ?? 0.0).toDouble();
      final updatedData = {
        ...Map<String, dynamic>.from(match),
        'buy_price': buyPrice,
        'sell_price': sellPrice,
        'stock': oldStock + addedStock,
      };
      await _makeRequest('POST', '/api/db/upsert', body: {
        'table': 'products',
        'id': productId,
        'data': updatedData,
      });
    }
  }

  Future<void> removeProduct(String id) async {
    await _makeRequest('POST', '/api/db/delete', body: {
      'table': 'products',
      'id': id,
    });
  }

  // -------------------------------------------------------------
  // 3. PURCHASES RESTOCK LEDGER
  // -------------------------------------------------------------

  Future<List<Purchase>> fetchPurchases() async {
    await _loadSession();
    if (_cachedSession == null) return [];
    final userId = _cachedSession!['id'];
    final list = await _makeRequest('GET', '/api/db/fetch?table=purchases&owner_email=$userId') ?? [];
    final result = (list as List).map((json) => Purchase.fromJson(Map<String, dynamic>.from(json))).toList();
    result.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return result;
  }

  Future<void> writePurchaseBill(Purchase pur) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    final id = pur.id.isNotEmpty ? pur.id : 'pur_${DateTime.now().millisecondsSinceEpoch}';
    
    final data = {
      'id': id,
      'owner_id': userId,
      'user_id': userId,
      'invoice_no': pur.invoiceNo,
      'product_id': pur.productId,
      'quantity': pur.quantity,
      'buy_price': pur.buyPrice,
      'created_at': DateTime.now().toIso8601String(),
    };
    
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'purchases',
      'id': id,
      'data': data,
    });
    
    final products = await _makeRequest('GET', '/api/db/fetch?table=products&owner_email=$userId') ?? [];
    final match = (products as List).firstWhere((p) => p['id'] == pur.productId, orElse: () => null);
    if (match != null) {
      final oldStock = (match['stock'] ?? 0.0).toDouble();
      final updatedData = {
        ...Map<String, dynamic>.from(match),
        'stock': oldStock + pur.quantity,
        'buy_price': pur.buyPrice,
      };
      await _makeRequest('POST', '/api/db/upsert', body: {
        'table': 'products',
        'id': pur.productId,
        'data': updatedData,
      });
    }
  }

  Future<void> updatePurchaseCost(String purchaseId, double updatedBuyPrice) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    
    final purchases = await _makeRequest('GET', '/api/db/fetch?table=purchases&owner_email=$userId') ?? [];
    final match = (purchases as List).firstWhere((p) => p['id'] == purchaseId, orElse: () => null);
    if (match != null) {
      final updatedData = {
        ...Map<String, dynamic>.from(match),
        'buy_price': updatedBuyPrice,
      };
      await _makeRequest('POST', '/api/db/upsert', body: {
        'table': 'purchases',
        'id': purchaseId,
        'data': updatedData,
      });
    }
  }

  Future<void> deletePurchaseBill(String id) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    
    final purchases = await _makeRequest('GET', '/api/db/fetch?table=purchases&owner_email=$userId') ?? [];
    final matchPur = (purchases as List).firstWhere((p) => p['id'] == id, orElse: () => null);
    if (matchPur != null) {
      final double quantity = (matchPur['quantity'] ?? 0.0).toDouble();
      final String productId = matchPur['product_id'] ?? '';
      
      final products = await _makeRequest('GET', '/api/db/fetch?table=products&owner_email=$userId') ?? [];
      final matchProd = (products as List).firstWhere((p) => p['id'] == productId, orElse: () => null);
      if (matchProd != null) {
        final double currentStock = (matchProd['stock'] ?? 0.0).toDouble();
        final updatedProd = {
          ...Map<String, dynamic>.from(matchProd),
          'stock': currentStock - quantity,
        };
        await _makeRequest('POST', '/api/db/upsert', body: {
          'table': 'products',
          'id': productId,
          'data': updatedProd,
        });
      }
      
      await _makeRequest('POST', '/api/db/delete', body: {
        'table': 'purchases',
        'id': id,
      });
    }
  }

  // -------------------------------------------------------------
  // 4. SALES CHECKOUT ENGINE
  // -------------------------------------------------------------

  Future<List<OrderTransaction>> fetchSalesLedger() async {
    await _loadSession();
    if (_cachedSession == null) return [];
    final userId = _cachedSession!['id'];
    
    final invoices = await _makeRequest('GET', '/api/db/fetch?table=transactions&owner_email=$userId') ?? [];
    final lineItems = await _makeRequest('GET', '/api/db/fetch?table=transaction_items&owner_email=$userId') ?? [];
    
    final List<OrderTransaction> result = [];
    for (var inv in invoices) {
      final String invoiceId = inv['id'];
      final relatedLineItems = (lineItems as List)
          .where((item) => item['transaction_id'] == invoiceId)
          .map((item) => TransactionItem.fromJson(Map<String, dynamic>.from(item)))
          .toList();
      result.add(OrderTransaction.fromJson(Map<String, dynamic>.from(inv), relatedLineItems));
    }
    result.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return result;
  }

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
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    final txId = 'tx_${DateTime.now().millisecondsSinceEpoch}';
    
    final txData = {
      'id': txId,
      'owner_id': userId,
      'user_id': userId,
      'invoice_no': invoiceNo,
      'customer_id': customerId,
      'total_amount': total,
      'discount': discount,
      'vat_rate': vatRate,
      'paid_amount': paid,
      'payment_method': method,
      'signature_svg': signatureBase64,
      'created_at': DateTime.now().toIso8601String(),
    };
    
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'transactions',
      'id': txId,
      'data': txData,
    });
    
    for (var item in cartItems) {
      final Product prod = item['product'];
      final double qty = item['quantity'];
      final double selectedPrice = item['sell_price'];
      final bool isNegative = prod.stock < qty;
      final itemUUID = 'txi_${DateTime.now().millisecondsSinceEpoch}_${prod.id}';
      
      final itemData = {
        'id': itemUUID,
        'owner_id': userId,
        'user_id': userId,
        'transaction_id': txId,
        'product_id': prod.id,
        'quantity': qty,
        'sell_price': selectedPrice,
        'cost_price': prod.buyPrice,
        'is_negative_sale': isNegative,
      };
      
      await _makeRequest('POST', '/api/db/upsert', body: {
        'table': 'transaction_items',
        'id': itemUUID,
        'data': itemData,
      });
      
      final products = await _makeRequest('GET', '/api/db/fetch?table=products&owner_email=$userId') ?? [];
      final match = (products as List).firstWhere((p) => p['id'] == prod.id, orElse: () => null);
      if (match != null) {
        final double currentStock = (match['stock'] ?? 0.0).toDouble();
        final updatedProd = {
          ...Map<String, dynamic>.from(match),
          'stock': currentStock - qty,
        };
        await _makeRequest('POST', '/api/db/upsert', body: {
          'table': 'products',
          'id': prod.id,
          'data': updatedProd,
        });
      }
    }
  }

  Future<void> deleteSaleMemo(OrderTransaction tx) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    
    for (var item in tx.items) {
      final products = await _makeRequest('GET', '/api/db/fetch?table=products&owner_email=$userId') ?? [];
      final match = (products as List).firstWhere((p) => p['id'] == item.productId, orElse: () => null);
      if (match != null) {
        final double stockNow = (match['stock'] ?? 0.0).toDouble();
        final updatedProd = {
          ...Map<String, dynamic>.from(match),
          'stock': stockNow + item.quantity,
        };
        await _makeRequest('POST', '/api/db/upsert', body: {
          'table': 'products',
          'id': item.productId,
          'data': updatedProd,
        });
      }
      
      await _makeRequest('POST', '/api/db/delete', body: {
        'table': 'transaction_items',
        'id': item.id,
      });
    }
    
    await _makeRequest('POST', '/api/db/delete', body: {
      'table': 'transactions',
      'id': tx.id,
    });
  }

  // -------------------------------------------------------------
  // 5. CRM CUSTOMERS & OUTGOINGS
  // -------------------------------------------------------------

  Future<List<Customer>> fetchCustomers() async {
    await _loadSession();
    if (_cachedSession == null) return [];
    final userId = _cachedSession!['id'];
    final list = await _makeRequest('GET', '/api/db/fetch?table=customers&owner_email=$userId') ?? [];
    return (list as List).map((e) => Customer.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<void> addCustomer(Customer client) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    final id = client.id.isNotEmpty ? client.id : 'cust_${DateTime.now().millisecondsSinceEpoch}';
    
    final data = {
      'id': id,
      'owner_id': userId,
      'user_id': userId,
      'name': client.name,
      'phone': client.phone,
      'address': client.address,
      'created_at': DateTime.now().toIso8601String(),
    };
    
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'customers',
      'id': id,
      'data': data,
    });
  }

  Future<List<Expense>> fetchExpenses() async {
    await _loadSession();
    if (_cachedSession == null) return [];
    final userId = _cachedSession!['id'];
    final list = await _makeRequest('GET', '/api/db/fetch?table=expenses&owner_email=$userId') ?? [];
    final result = (list as List).map((e) => Expense.fromJson(Map<String, dynamic>.from(e))).toList();
    result.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return result;
  }

  Future<void> logExpense(Expense exp) async {
    await _loadSession();
    final userId = _cachedSession?['id'] ?? '';
    final id = exp.id.isNotEmpty ? exp.id : 'exp_${DateTime.now().millisecondsSinceEpoch}';
    
    final data = {
      'id': id,
      'owner_id': userId,
      'user_id': userId,
      'description': exp.description,
      'category': exp.category,
      'amount': exp.amount,
      'created_at': DateTime.now().toIso8601String(),
    };
    
    await _makeRequest('POST', '/api/db/upsert', body: {
      'table': 'expenses',
      'id': id,
      'data': data,
    });
  }

  Future<void> deleteExpense(String id) async {
    await _makeRequest('POST', '/api/db/delete', body: {
      'table': 'expenses',
      'id': id,
    });
  }

  // -------------------------------------------------------------
  // 6. REAL-TIME MULTI-FILTER REPORT AGGREGATES
  // -------------------------------------------------------------

  Future<Map<String, double>> queryDynamicPnLSummary() async {
    try {
      final ledger = await fetchSalesLedger();
      final expenses = await fetchExpenses();
      
      double sales = 0.0;
      double cogs = 0.0;
      double discounts = 0.0;
      double totalExpenses = 0.0;
      
      for (final tx in ledger) {
        sales += tx.totalAmount;
        discounts += tx.discount;
        for (final item in tx.items) {
          cogs += item.quantity * item.costPrice;
        }
      }
      
      for (final exp in expenses) {
        totalExpenses += exp.amount;
      }
      
      return {
        'sales': sales,
        'cogs': cogs,
        'discounts': discounts,
        'expenses': totalExpenses,
        'net_profit': sales - cogs - totalExpenses,
      };
    } catch (_) {
      return {'sales': 0.0, 'cogs': 0.0, 'discounts': 0.0, 'expenses': 0.0, 'net_profit': 0.0};
    }
  }

  // -------------------------------------------------------------
  // 7. REAL-TIME SYSTEM STREAM POLLING EMULATORS (Timer-driven)
  // -------------------------------------------------------------

  Stream<List<Product>> productsStream() {
    final controller = StreamController<List<Product>>();
    fetchProducts().then((res) => controller.add(res)).catchError((e) {});
    final timer = Timer.periodic(const Duration(seconds: 4), (_) async {
      if (_cachedSession != null && !controller.isClosed) {
        try {
          final res = await fetchProducts();
          if (!controller.isClosed) controller.add(res);
        } catch (_) {}
      }
    });
    controller.onCancel = () {
      timer.cancel();
      controller.close();
    };
    return controller.stream;
  }

  Stream<List<Purchase>> purchasesStream() {
    final controller = StreamController<List<Purchase>>();
    fetchPurchases().then((res) => controller.add(res)).catchError((e) {});
    final timer = Timer.periodic(const Duration(seconds: 4), (_) async {
      if (_cachedSession != null && !controller.isClosed) {
        try {
          final res = await fetchPurchases();
          if (!controller.isClosed) controller.add(res);
        } catch (_) {}
      }
    });
    controller.onCancel = () {
      timer.cancel();
      controller.close();
    };
    return controller.stream;
  }

  Stream<List<Customer>> customersStream() {
    final controller = StreamController<List<Customer>>();
    fetchCustomers().then((res) => controller.add(res)).catchError((e) {});
    final timer = Timer.periodic(const Duration(seconds: 4), (_) async {
      if (_cachedSession != null && !controller.isClosed) {
        try {
          final res = await fetchCustomers();
          if (!controller.isClosed) controller.add(res);
        } catch (_) {}
      }
    });
    controller.onCancel = () {
      timer.cancel();
      controller.close();
    };
    return controller.stream;
  }

  Stream<List<Expense>> expensesStream() {
    final controller = StreamController<List<Expense>>();
    fetchExpenses().then((res) => controller.add(res)).catchError((e) {});
    final timer = Timer.periodic(const Duration(seconds: 4), (_) async {
      if (_cachedSession != null && !controller.isClosed) {
        try {
          final res = await fetchExpenses();
          if (!controller.isClosed) controller.add(res);
        } catch (_) {}
      }
    });
    controller.onCancel = () {
      timer.cancel();
      controller.close();
    };
    return controller.stream;
  }

  Stream<List<OrderTransaction>> transactionsStream() {
    final controller = StreamController<List<OrderTransaction>>();
    fetchSalesLedger().then((res) => controller.add(res)).catchError((e) {});
    final timer = Timer.periodic(const Duration(seconds: 4), (_) async {
      if (_cachedSession != null && !controller.isClosed) {
        try {
          final res = await fetchSalesLedger();
          if (!controller.isClosed) controller.add(res);
        } catch (_) {}
      }
    });
    controller.onCancel = () {
      timer.cancel();
      controller.close();
    };
    return controller.stream;
  }
}
