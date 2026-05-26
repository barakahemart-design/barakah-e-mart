// =========================================================================
// STATE MANAGEMENT VIA PROVIDER (billing_provider.dart)
// Direct state management bindings for checkout calculations & UI alerts.
// =========================================================================

import 'package:flutter/material.dart';
import 'models.dart';
import 'supabase_service.dart';

enum AppMode { userMode, guestMode }
enum DateRangeFilter { daily, weekly, monthly, yearly, custom }

class BillingProvider with ChangeNotifier {
  final SupabaseService _db = SupabaseService();

  // Primary System State
  bool _isLoading = false;
  AppMode _appMode = AppMode.userMode;
  UserProfile? _profile;
  String _currentPanel = 'none'; // 'none' (not logged), 'admin', 'sales', 'setup'

  // Screen Security Locks
  bool _isScreenLocked = true;
  bool _hasBypassedSetup = false;

  // Global Typography Scaling
  String _fontSizeScale = 'Regular'; // 'Regular', 'Medium', 'Large'

  // Data Collections
  List<Product> _products = [];
  List<Customer> _customers = [];
  List<Purchase> _purchases = [];
  List<Expense> _expenses = [];
  List<OrderTransaction> _salesLedger = [];

  // Active POS POS Cart Basket State
  final List<Map<String, dynamic>> _cart = []; // {'product': Product, 'quantity': double, 'sell_price': double}
  double _cartDiscount = 0.0;
  double _cartVatRate = 0.0; // default 0% (percentage calculations disabled)
  String _selectedPaymentMethod = 'Cash';
  Customer? _selectedCartCustomer;

  // Overview Filters
  DateRangeFilter _activeFilter = DateRangeFilter.daily;
  DateTimeRange? _customDateRange;

  BillingProvider() {
    _initializeSession();
  }

  // Passcode Configuration Health Checks
  bool get isPasscodeConfigured {
    if (_profile == null) return false;
    final admin = _profile!.adminPasscode.trim();
    final sales = _profile!.salesPasscode.trim();
    // Empty value or default placeholder pins are treated as unconfigured
    return admin.isNotEmpty &&
        sales.isNotEmpty &&
        admin != "1234" &&
        sales != "5555" &&
        admin != "unset" &&
        sales != "unset";
  }

  Future<void> _initializeSession() async {
    final savedProfile = await _db.fetchCurrentUserProfile();
    if (savedProfile != null) {
      _setLoading(true);
      try {
        _profile = savedProfile;
        _appMode = AppMode.userMode;
        
        // Secure Initial State Determination
        if (isPasscodeConfigured) {
          _isScreenLocked = true;
          _currentPanel = 'none'; // Must verify on screen lock first
        } else {
          _isScreenLocked = false;
          _currentPanel = 'admin'; // Land on admin dashboard but insecure warning active!
        }
        notifyListeners(); // Navigate out of login immediately
        await syncAllData();
      } catch (_) {
        // Safe fallback
      } finally {
        _setLoading(false);
      }
    }
  }

  // Getters
  bool get isLoading => _isLoading;
  AppMode get appMode => _appMode;
  UserProfile? get profile => _profile;
  String get currentPanel => _currentPanel;
  bool get isScreenLocked => _isScreenLocked;
  bool get hasBypassedSetup => _hasBypassedSetup;
  String get fontSizeScale => _fontSizeScale;
  List<Product> get products => _products;
  List<Customer> get customers => _customers;
  List<Purchase> get purchases => _purchases;
  List<Expense> get expenses => _expenses;
  List<OrderTransaction> get salesLedger => _salesLedger;

  void saveFontSizeScale(String scale) {
    if (scale == 'Regular' || scale == 'Medium' || scale == 'Large') {
      _fontSizeScale = scale;
      notifyListeners();
    }
  }

  List<Map<String, dynamic>> get cart => _cart;
  double get cartDiscount => _cartDiscount;
  double get cartVatRate => _cartVatRate;
  String get selectedPaymentMethod => _selectedPaymentMethod;
  Customer? get selectedCartCustomer => _selectedCartCustomer;
  DateRangeFilter get activeFilter => _activeFilter;
  DateTimeRange? get customDateRange => _customDateRange;

  // Dynamic Math Calculators
  double get cartSubtotal {
    return _cart.fold(0.0, (sum, item) => sum + (item['quantity'] * item['sell_price']));
  }

  double get cartVatAmount => 0.0; // Disabled percentage tax calculations globally

  double get cartGrandTotal {
    final double res = cartSubtotal - _cartDiscount + cartVatAmount;
    return res > 0 ? res : 0.0;
  }

  // -----------------------------------------------------------------
  // 1. REGISTRATION, LOGIN & LOCK PANELS CONTROL
  // -----------------------------------------------------------------

  Future<void> login(String email, String password) async {
    _setLoading(true);
    try {
      _profile = await _db.loginWithEmail(email: email.trim(), password: password.trim());
      _appMode = AppMode.userMode;
      _hasBypassedSetup = false;
      
      if (isPasscodeConfigured) {
        _isScreenLocked = true;
        _currentPanel = 'none';
      } else {
        _isScreenLocked = false;
        _currentPanel = 'admin';
      }
      
      notifyListeners(); // Notify immediately so routing/auto-navigation triggers instantly!
      await syncAllData();
    } catch (e) {
      _setLoading(false);
      rethrow;
    }
  }

  Future<void> registerAndInitiate({
    required String email,
    required String password,
    required String shopName,
    required String adminPass,
    required String salesPass,
  }) async {
    _setLoading(true);
    try {
      _profile = await _db.registerUser(
        email: email.trim(),
        password: password.trim(),
        shopName: shopName,
        adminPasscode: adminPass.trim(),
        salesPasscode: salesPass.trim(),
      );
      _appMode = AppMode.userMode;
      _hasBypassedSetup = false;

      if (isPasscodeConfigured) {
        _isScreenLocked = true;
        _currentPanel = 'none';
      } else {
        _isScreenLocked = false;
        _currentPanel = 'admin';
      }

      notifyListeners(); // Notify immediately so routing/auto-navigation triggers instantly!
      await syncAllData();
    } catch (e) {
      _setLoading(false);
      rethrow;
    }
  }

  void activateGuestMode() {
    _appMode = AppMode.guestMode;
    _currentPanel = 'admin';
    _isScreenLocked = false;
    _hasBypassedSetup = true;
    _profile = UserProfile(
      id: 'guest_uid_123',
      email: 'guest@barakah.com',
      shopName: 'Barakah Electronics (Guest)',
      shopAddress: 'Showroom Gate 2, Stadium Market, Dhaka',
      supportPhone: '01700-000000',
      vatRegId: 'VAT-GUEST-12345',
      adminPasscode: '9999', // Non-default to pass security config check internally
      salesPasscode: '8888',
      currencySymbol: '৳',
      showLogoInInvoice: true,
      termsConditions: 'Mock guest limits active.',
    );
    notifyListeners();
  }

  /// Bypass setup completely to enter dashboard manually
  void bypassSetup() {
    _hasBypassedSetup = true;
    _isScreenLocked = false;
    _currentPanel = 'admin';
    notifyListeners();
  }

  /// Master Passcode Security Setter
  Future<void> updatePasscodes(String adminPass, String salesPass) async {
    if (_profile == null) return;
    _setLoading(true);
    try {
      final updatedProfile = UserProfile(
        id: _profile!.id,
        email: _profile!.email,
        shopName: _profile!.shopName,
        shopAddress: _profile!.shopAddress,
        supportPhone: _profile!.supportPhone,
        vatRegId: _profile!.vatRegId,
        adminPasscode: adminPass.trim(),
        salesPasscode: salesPass.trim(),
        currencySymbol: _profile!.currencySymbol,
        showLogoInInvoice: _profile!.showLogoInInvoice,
        termsConditions: _profile!.termsConditions,
        companyLogoUrl: _profile!.companyLogoUrl,
      );

      await _db.saveUserProfile(updatedProfile);
      _profile = updatedProfile;
      
      // Passcodes set successfully! Enforce proper unlocked Admin dashboard state
      _hasBypassedSetup = false;
      _isScreenLocked = false;
      _currentPanel = 'admin';
      notifyListeners();
    } finally {
      _setLoading(false);
    }
  }

  /// Lock panel down or authenticate back
  bool challengePanelPin(String pin, String destinationPanel) {
    if (_profile == null) return false;

    if (destinationPanel == 'admin') {
      if (_profile!.adminPasscode == pin) {
        _currentPanel = 'admin';
        _isScreenLocked = false;
        notifyListeners();
        return true;
      }
    } else if (destinationPanel == 'sales') {
      if (_profile!.salesPasscode == pin) {
        _currentPanel = 'sales';
        _isScreenLocked = false;
        notifyListeners();
        return true;
      }
    }
    return false;
  }

  void switchInstantlyToSales() {
    // Admin is authorized to drop to cashier (Sales Panel) instantly
    _currentPanel = 'sales';
    _cart.clear(); // Flush basket for security
    notifyListeners();
  }

  Future<void> logOut() async {
    _profile = null;
    _currentPanel = 'none';
    _isScreenLocked = true;
    _hasBypassedSetup = false;
    _cart.clear();
    _products.clear();
    _customers.clear();
    _purchases.clear();
    _expenses.clear();
    _salesLedger.clear();
    notifyListeners();
    try {
      await _db.signOut();
    } catch (_) {
      // safe fallback
    }
  }

  // -----------------------------------------------------------------
  // 2. BACKEND REMOTE INTEGRATION FETCHES
  // -----------------------------------------------------------------

  Future<void> syncAllData() async {
    if (_appMode == AppMode.guestMode) return;
    _setLoading(true);
    try {
      _products = await _db.fetchProducts();
      _customers = await _db.fetchCustomers();
      _purchases = await _db.fetchPurchases();
      _expenses = await _db.fetchExpenses();
      _salesLedger = await _db.fetchSalesLedger();
    } catch (e) {
      // Offline fallback handling gracefully
    } finally {
      _setLoading(false);
    }
  }

  void _setLoading(bool val) {
    _isLoading = val;
    notifyListeners();
  }

  // -----------------------------------------------------------------
  // 3. SELLING BASKET (POS CART) WORKSPACE LOGIC
  // -----------------------------------------------------------------

  void addToCart(Product prod, double qty, double overridenPrice) {
    // Check if product lines line already exist
    final index = _cart.indexWhere((element) => element['product'].id == prod.id);
    if (index >= 0) {
      _cart[index]['quantity'] += qty;
    } else {
      _cart.add({
        'product': prod,
        'quantity': qty,
        'sell_price': overridenPrice,
      });
    }
    notifyListeners();
  }

  void updateCartQty(int index, double newQty) {
    if (newQty <= 0) {
      _cart.removeAt(index);
    } else {
      _cart[index]['quantity'] = newQty;
    }
    notifyListeners();
  }

  void removeCartItem(int index) {
    _cart.removeAt(index);
    notifyListeners();
  }

  void configureCartBilling({double? disc, double? tax, String? payment, Customer? client}) {
    if (disc != null) _cartDiscount = disc;
    if (tax != null) _cartVatRate = tax;
    if (payment != null) _selectedPaymentMethod = payment;
    if (client != null) _selectedCartCustomer = client;
    notifyListeners();
  }

  Future<void> executeCheckoutCart(String invoiceNo, String? signatureBase64) async {
    if (_cart.isEmpty) throw Exception("Checkout cart is currently empty.");

    _setLoading(true);
    try {
      if (_appMode == AppMode.userMode) {
        await _db.executeCheckout(
          cartItems: _cart,
          total: cartGrandTotal,
          discount: _cartDiscount,
          vatRate: _cartVatRate,
          paid: _selectedPaymentMethod == 'Due' ? 0.0 : cartGrandTotal,
          method: _selectedPaymentMethod,
          invoiceNo: invoiceNo,
          customerId: _selectedCartCustomer?.id,
          signatureBase64: signatureBase64,
        );
        await syncAllData();
      } else {
        // Guest mode mock inserts
        _products = _products.map((p) {
          final cartLine = _cart.firstWhere((c) => c['product'].id == p.id, orElse: () => {});
          if (cartLine.isNotEmpty) {
            return Product(
              id: p.id,
              ownerId: p.ownerId,
              name: p.name,
              category: p.category,
              buyPrice: p.buyPrice,
              sellPrice: p.sellPrice,
              stock: p.stock - cartLine['quantity'],
              unit: p.unit,
            );
          }
          return p;
        }).toList();
      }
      _cart.clear();
      _cartDiscount = 0.0;
      _selectedCartCustomer = null;
    } finally {
      _setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // 4. INVENTORY & VOUCHERS MUTATIONS
  // -------------------------------------------------------------

  Future<void> addProductToCatalog(String name, String sku, String cat, double buy, double sell, double initStock, String unit) async {
    final prod = Product(id: '', ownerId: '', name: name, sku: sku, category: cat, buyPrice: buy, sellPrice: sell, stock: initStock, unit: unit);
    if (_appMode == AppMode.userMode) {
      await _db.addProduct(prod);
      await syncAllData();
    } else {
      _products.add(Product(id: DateTime.now().toString(), ownerId: 'guest', name: name, sku: sku, category: cat, buyPrice: buy, sellPrice: sell, stock: initStock, unit: unit));
      notifyListeners();
    }
  }

  Future<void> logNewPurchase(String invoice, String productId, double qty, double rate) async {
    final purchaseObj = Purchase(id: '', ownerId: '', invoiceNo: invoice, productId: productId, quantity: qty, buyPrice: rate, createdAt: DateTime.now());
    if (_appMode == AppMode.userMode) {
      await _db.writePurchaseBill(purchaseObj);
      await syncAllData();
    } else {
      _products = _products.map((p) {
        if (p.id == productId) {
          return Product(id: p.id, ownerId: p.ownerId, name: p.name, category: p.category, buyPrice: rate, sellPrice: p.sellPrice, stock: p.stock + qty, unit: p.unit);
        }
        return p;
      }).toList();
      notifyListeners();
    }
  }

  Future<void> editPurchaseCostBill(String purchaseId, String productId, double updatedCost) async {
    if (_appMode == AppMode.userMode) {
      await _db.updatePurchaseCost(purchaseId, updatedCost);
      await syncAllData();
    } else {
      notifyListeners();
    }
  }

  Future<void> registerCustomerDetails(String name, String phone, String addr) async {
    final c = Customer(id: '', ownerId: '', name: name, phone: phone, address: addr, createdAt: DateTime.now());
    if (_appMode == AppMode.userMode) {
      await _db.addCustomer(c);
      await syncAllData();
    } else {
      _customers.add(Customer(id: DateTime.now().toString(), ownerId: 'guest', name: name, phone: phone, address: addr, createdAt: DateTime.now()));
      notifyListeners();
    }
  }

  Future<void> logExpenseVoucher(String desc, String cat, double amt) async {
    final e = Expense(id: '', ownerId: '', description: desc, category: cat, amount: amt, createdAt: DateTime.now());
    if (_appMode == AppMode.userMode) {
      await _db.logExpense(e);
      await syncAllData();
    } else {
      _expenses.add(Expense(id: DateTime.now().toString(), ownerId: 'guest', description: desc, category: cat, amount: amt, createdAt: DateTime.now()));
      notifyListeners();
    }
  }

  Future<void> deleteExpenseVoucher(String id) async {
    if (_appMode == AppMode.userMode) {
      await _db.deleteExpense(id);
      await syncAllData();
    } else {
      _expenses.removeWhere((e) => e.id == id);
      notifyListeners();
    }
  }

  Future<void> purgeData(bool deleteAcc) async {
    if (_appMode == AppMode.userMode) {
      await _db.purgeUserData(_profile!.id, deleteAccount: deleteAcc);
      logOut();
    } else {
      _products.clear();
      _customers.clear();
      _purchases.clear();
      _expenses.clear();
      logOut();
    }
  }

  // -------------------------------------------------------------
  // 5. INVOICE IN-WORDS CONVERTER
  // -------------------------------------------------------------

  String convertToWords(double amount) {
    if (amount <= 0) return "Zero Taka Only";
    final int value = amount.round();
    
    final List<String> units = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    final List<String> tens = [
      "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    String formatBelowThousand(int n) {
      if (n < 20) return units[n];
      if (n < 100) return tens[n ~/ 10] + (n % 10 != 0 ? " " + units[n % 10] : "");
      return units[n ~/ 100] + " Hundred" + (n % 100 != 0 ? " and " + formatBelowThousand(n % 100) : "");
    }

    String wordString = "";
    int temp = value;

    if (temp >= 10000000) { // Crore (Bangladesh Context)
      final int crore = temp ~/ 10000000;
      wordString += formatBelowThousand(crore) + " Crore ";
      temp %= 10000000;
    }
    if (temp >= 100000) { // Lakh (Bangladesh Context)
      final int lakh = temp ~/ 100000;
      wordString += formatBelowThousand(lakh) + " Lakh ";
      temp %= 100000;
    }
    if (temp >= 1000) { // Thousand
      final int thousand = temp ~/ 1000;
      wordString += formatBelowThousand(thousand) + " Thousand ";
      temp %= 1000;
    }
    if (temp > 0) {
      wordString += formatBelowThousand(temp);
    }

    return wordString.trim() + " Taka Only";
  }
}
