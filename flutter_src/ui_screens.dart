// =========================================================================
// CUSTOM REACTIONAL UI WORKSPACE (ui_screens.dart)
// Beautiful, modular Flutter screen views incorporating Bangladesh localized constraints.
// =========================================================================

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'billing_provider.dart';
import 'models.dart';

// -----------------------------------------------------------------
// 1. GATEWAY GATE: AUTH SCREEN (Email, Pin Codes & Guest Entry)
// -----------------------------------------------------------------

enum AuthView { start, login, register }

class AuthScreen extends StatefulWidget {
  const AuthScreen({Key? key}) : super(key: key);

  @override
  _AuthScreenState createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  AuthView _currentView = AuthView.start;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 440,
            padding: const EdgeInsets.all(36),
            decoration: BoxDecoration(
              color: const Color(0xFF0C111D),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFF1F2937), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.4),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                )
              ],
            ),
            child: _buildContent(context, bp),
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, BillingProvider bp) {
    switch (_currentView) {
      case AuthView.start:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.bolt, size: 56, color: Colors.amber),
            const SizedBox(height: 16),
            const Text(
              "⚡ BARAKAH PRO",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: "JetBrains Mono",
                color: Colors.amber,
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              "Bangladesh Premium Smart Billing Engine",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 40),

            // Two Beautiful, Prominent Buttons
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _currentView = AuthView.login;
                  _formKey.currentState?.reset();
                });
              },
              icon: const Icon(Icons.login, color: Colors.black),
              label: const Text(
                "LOG IN TO ACCOUNT",
                style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.5),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 2,
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {
                setState(() {
                  _currentView = AuthView.register;
                  _formKey.currentState?.reset();
                });
              },
              icon: const Icon(Icons.person_add_outlined, color: Colors.amber),
              label: const Text(
                "REGISTER NEW ACCOUNT",
                style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.5),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.amber, width: 1.5),
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            
            const SizedBox(height: 32),
            const Divider(color: Color(0xFF1F2937), thickness: 1),
            const SizedBox(height: 20),
            
            TextButton(
              onPressed: () => bp.activateGuestMode(),
              child: const Text(
                "Enter Guest Playground Mode",
                style: TextStyle(color: Colors.grey, fontSize: 12, decoration: TextDecoration.underline),
              ),
            ),
          ],
        );

      case AuthView.login:
      case AuthView.register:
        final prefixTitle = _currentView == AuthView.login ? "Sign In" : "Register";
        final actionText = _currentView == AuthView.login ? "AUTHENTICATE PROFILE" : "PROVISION ACCOUNT";
        
        return Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () {
                      setState(() {
                        _currentView = AuthView.start;
                      });
                    },
                    icon: const Icon(Icons.arrow_back, color: Colors.grey),
                  ),
                  const Spacer(),
                  const Text(
                    "BARAKAH PRO",
                    style: TextStyle(fontFamily: "JetBrains Mono", color: Colors.amber, fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  const SizedBox(width: 48), // balance arrow
                ],
              ),
              const SizedBox(height: 16),
              Text(
                _currentView == AuthView.login ? "Access Your Checkout Counter" : "Provision Shop Security Workspace",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _currentView == AuthView.login 
                    ? "Enter your registered Gmail & master security password."
                    : "Sign up with your Gmail & secure authentication password.",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey, fontSize: 12),
              ),
              const SizedBox(height: 28),

              // Email Input
              TextFormField(
                controller: _emailCtrl,
                style: const TextStyle(color: Colors.white),
                keyboardType: TextInputType.emailAddress,
                decoration: _inputStyle("Gmail Address"),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return "Email address is required";
                  if (!v.contains("@")) return "Enter a valid email address";
                  return null;
                },
              ),
              const SizedBox(height: 18),

              // Password Input
              TextFormField(
                controller: _passCtrl,
                obscureText: true,
                style: const TextStyle(color: Colors.white),
                decoration: _inputStyle("Security Password"),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return "Password cannot be empty";
                  if (v.trim().length < 6) return "Password must be at least 6 characters";
                  return null;
                },
              ),
              const SizedBox(height: 28),

              ElevatedButton(
                onPressed: () async {
                  if (_formKey.currentState!.validate()) {
                    final email = _emailCtrl.text.trim();
                    final password = _passCtrl.text.trim();

                    try {
                      if (_currentView == AuthView.register) {
                        // Register new user: Gmail + Password. Set pins as "unset" to trigger setup screen first!
                        await bp.registerAndInitiate(
                          email: email,
                          password: password,
                          shopName: "Barakah Shop",
                          adminPass: "unset",
                          salesPass: "unset",
                        );
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Account created! Please establish your panel passwords."),
                            backgroundColor: Colors.emerald,
                          ),
                        );
                      } else {
                        // Log In Flow: Gmail + Password
                        await bp.login(email, password);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Login successful! Welcome back."),
                            backgroundColor: Colors.emerald,
                          ),
                        );
                      }
                    } on AuthException catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(e.message),
                          backgroundColor: Colors.rose,
                        ),
                      );
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text("Action Failed: ${e.toString()}"),
                          backgroundColor: Colors.rose,
                        ),
                      );
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: bp.isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2.5),
                      )
                    : Text(
                        actionText,
                        style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                      ),
              ),

              const SizedBox(height: 18),
              TextButton(
                onPressed: () {
                  setState(() {
                    _currentView = _currentView == AuthView.login ? AuthView.register : AuthView.login;
                    _formKey.currentState?.reset();
                  });
                },
                child: Text(
                  _currentView == AuthView.login 
                      ? "Don't have an account? Start registering" 
                      : "Already have an account? Sign in here",
                  style: const TextStyle(color: Colors.grey, fontSize: 13),
                ),
              ),
            ],
          ),
        );
    }
  }

  InputDecoration _inputStyle(String label) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.grey, fontSize: 13),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFF1F2937)),
        borderRadius: BorderRadius.circular(12),
      ),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Colors.amber),
        borderRadius: BorderRadius.circular(12),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }
}


// -----------------------------------------------------------------
// 1.1 PANEL PASSCODE SETUP CONTROL
// -----------------------------------------------------------------

class PanelPasswordSetupScreen extends StatefulWidget {
  const PanelPasswordSetupScreen({Key? key}) : super(key: key);

  @override
  _PanelPasswordSetupScreenState createState() => _PanelPasswordSetupScreenState();
}

class _PanelPasswordSetupScreenState extends State<PanelPasswordSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _adminCtrl = TextEditingController();
  final _salesCtrl = TextEditingController();

  @override
  void dispose() {
    _adminCtrl.dispose();
    _salesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 460,
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: const Color(0xFF0C111D),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.amber.withOpacity(0.3), width: 1.5),
            ),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.security, size: 48, color: Colors.amber),
                  const SizedBox(height: 16),
                  const Text(
                    "Panel Password Setup",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "You are configuring security passcodes for the first time. Establish distinct numeric passwords to secure your system panels.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                  const SizedBox(height: 32),

                  // Admin Passcode Input
                  TextFormField(
                    controller: _adminCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white, fontFamily: "JetBrains Mono"),
                    decoration: InputDecoration(
                      labelText: "Admin Passcode (Owner)",
                      labelStyle: const TextStyle(color: Colors.grey, fontSize: 13),
                      enabledBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Color(0xFF1F2937)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.amber),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return "Admin passcode is required";
                      if (v.trim().length < 4) return "Passcode must be at least 4 digits";
                      if (v.trim() == "1234") return "Cannot use weak default passcode '1234'";
                      if (v.trim() == "unset") return "Cannot use system reserve 'unset'";
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Sales Passcode Input
                  TextFormField(
                    controller: _salesCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white, fontFamily: "JetBrains Mono"),
                    decoration: InputDecoration(
                      labelText: "Sales Passcode (Cashier)",
                      labelStyle: const TextStyle(color: Colors.grey, fontSize: 13),
                      enabledBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Color(0xFF1F2937)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.amber),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return "Sales passcode is required";
                      if (v.trim().length < 4) return "Passcode must be at least 4 digits";
                      if (v.trim() == "5555") return "Cannot use weak default passcode '5555'";
                      if (v.trim() == "unset") return "Cannot use system reserve 'unset'";
                      if (v.trim() == _adminCtrl.text.trim()) return "Passcodes must be distinct";
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton(
                    onPressed: () async {
                      if (_formKey.currentState!.validate()) {
                        try {
                          await bp.updatePasscodes(
                            _adminCtrl.text.trim(),
                            _salesCtrl.text.trim(),
                          );
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("Setup complete! Security locks are active."),
                              backgroundColor: Colors.emerald,
                            ),
                          );
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text("Setup failed: ${e.toString()}"),
                              backgroundColor: Colors.rose,
                            ),
                          );
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: bp.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                          )
                        : const Text(
                            "SAVE & SECURE STORE",
                            style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                          ),
                  ),

                  const SizedBox(height: 16),
                  
                  // Text indicating bypass is disabled for mandatory setup
                  const Text(
                    "🔐 You must set distinct secure passwords to initialize your dashboard workspace.",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey, fontSize: 11, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------
// 1.2 SCREEN LOCK CONTROL
// -----------------------------------------------------------------

class ScreenLockScreen extends StatefulWidget {
  const ScreenLockScreen({Key? key}) : super(key: key);

  @override
  _ScreenLockScreenState createState() => _ScreenLockScreenState();
}

class _ScreenLockScreenState extends State<ScreenLockScreen> {
  final _pinCtrl = TextEditingController();
  String _errorText = '';

  @override
  void dispose() {
    _pinCtrl.dispose();
    super.dispose();
  }

  void _handleUnlock(BillingProvider bp) {
    setState(() {
      _errorText = '';
    });
    final pin = _pinCtrl.text.trim();
    if (pin.isEmpty) {
      setState(() {
        _errorText = 'Enter standard authorization code';
      });
      return;
    }

    // Try Admin access
    if (bp.challengePanelPin(pin, 'admin')) {
      _pinCtrl.clear();
      return;
    }

    // Try Sales access
    if (bp.challengePanelPin(pin, 'sales')) {
      _pinCtrl.clear();
      return;
    }

    // If both failed
    setState(() {
      _errorText = 'Invalid security passcode';
    });
  }

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 400,
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: const Color(0xFF0C111D),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFF1F2937), width: 1.5),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock_outline, size: 54, color: Colors.amber),
                const SizedBox(height: 16),
                Text(
                  bp.profile?.shopName ?? "Barakah Shop",
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                const Text(
                  "SECURE PANEL ACCESS LOCKED",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                ),
                const SizedBox(height: 24),
                
                // PIN entry
                TextField(
                  controller: _pinCtrl,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  style: const TextStyle(color: Colors.white, fontSize: 20, letterSpacing: 8, fontFamily: "JetBrains Mono", fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                  onSubmitted: (_) => _handleUnlock(bp),
                  decoration: InputDecoration(
                    hintText: "••••",
                    hintStyle: const TextStyle(color: Colors.grey, letterSpacing: 8),
                    enabledBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFF1F2937)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Colors.amber),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                
                if (_errorText.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    _errorText,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.rose, fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                ],

                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: () => _handleUnlock(bp),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    "UNLOCK PANEL",
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                  ),
                ),

                const SizedBox(height: 16),
                
                TextButton.icon(
                  onPressed: () => bp.logOut(),
                  icon: const Icon(Icons.logout, color: Colors.rose, size: 16),
                  label: const Text("Switch Store Account", style: TextStyle(color: Colors.rose)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}


// -----------------------------------------------------------------
// 2. PRIMARY SCREEN: MAIN INDEX PAGE WITH RESTRICTED NAVIGATION
// -----------------------------------------------------------------

class MainNavigationWorkspace extends StatefulWidget {
  const MainNavigationWorkspace({Key? key}) : super(key: key);

  @override
  _MainNavigationWorkspaceState createState() => _MainNavigationWorkspaceState();
}

class _MainNavigationWorkspaceState extends State<MainNavigationWorkspace> {
  String _activeTab = "dashboard";

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);
    final String panel = bp.currentPanel;

    // Strict salesman access restriction filter
    final bool isSalesman = panel == "sales";

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Row(
        children: [
          // A BEAUTIFUL LEFT SIDEBAR SCREEN
          Container(
            width: 260,
            color: const Color(0xFF080D1A),
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Shop details header
                Text(
                  bp.profile?.shopName ?? "Barakah Shop",
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Text(
                  bp.appMode == AppMode.userMode ? "USER MODE" : "GUEST MODE",
                  style: const TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold),
                ).paddingOnly(bottom: 24),

                // Access panel items with role lock triggers
                _sidebarItem("Daily Sales", "pos", Icons.shopping_cart),
                _sidebarItem("Add Customer", "customers", Icons.person_add),
                _sidebarItem("View Products", "products", Icons.view_list),

                // Hidden pages only accessible to the Admin roles
                if (!isSalesman) ...[
                  _sidebarItem("Dashboard", "dashboard", Icons.dashboard),
                  _sidebarItem("Minus Stock Sale", "minus-stock", Icons.warning),
                  _sidebarItem("Purchases Ledger", "purchases", Icons.add_shopping_cart),
                  _sidebarItem("Expenses Ledger", "expenses", Icons.receipt_long),
                  _sidebarItem("Settings", "settings", Icons.settings),
                ],

                const Spacer(),

                // Toggle Access panel locking systems
                if (isSalesman) ...[
                  ElevatedButton(
                    onPressed: () => _showUnlockDialog(context, bp, "admin"),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.amber),
                    child: const Text("ADMIN PANELS UNLOCK", style: TextStyle(color: Colors.black)),
                  )
                ] else ...[
                  OutlinedButton(
                    onPressed: () => bp.switchInstantlyToSales(),
                    style: OutlinedButton.styleFrom(side: const BorderSide(color: Colors.amber)),
                    child: const Text("SWITCH TO SALES PANELS", style: TextStyle(color: Colors.amber)),
                  )
                ],

                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: () => bp.logOut(),
                  icon: const Icon(Icons.logout, color: Colors.rose, size: 16),
                  label: const Text("Exit Store", style: TextStyle(color: Colors.rose)),
                )
              ],
            ),
          ),

          // Main Screen Tab Container View
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!bp.isPasscodeConfigured)
                    Container(
                      margin: const EdgeInsets.only(bottom: 24),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.withOpacity(0.4)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning, color: Colors.redAccent, size: 22),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              "⚠️ SYSTEM SECURITY ALERT: You are using weak default passcodes (1234/5555). Your database is insecure. Set secure passcodes in Settings.",
                              style: TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ),
                          if (!isSalesman) ...[
                            const SizedBox(width: 12),
                            TextButton(
                              onPressed: () {
                                setState(() => _activeTab = "settings");
                              },
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.amber,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              child: const Text("FIX SECURITY NOW"),
                            ),
                          ],
                        ],
                      ),
                    ),
                  Expanded(
                    child: _renderActiveView(bp),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sidebarItem(String title, String tabId, IconData icon) {
    final bool isSelected = _activeTab == tabId;
    return InkWell(
      onTap: () => setState(() => _activeTab = tabId),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1E293B) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(icon, color: isSelected ? Colors.amber : Colors.grey, size: 20),
            const SizedBox(width: 12),
            Text(
              title,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.grey,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            )
          ],
        ),
      ).paddingOnly(bottom: 8),
    );
  }

  Widget _renderActiveView(BillingProvider bp) {
    switch (_activeTab) {
      case "dashboard":
        return const DashboardView();
      case "pos":
        return const SalesCounterView();
      case "customers":
        return const CustomersListView();
      case "products":
        return const ProductsCatalogView();
      case "minus-stock":
        return const MinusStockTrackerView();
      case "purchases":
        return const PurchasesLedgerView();
      case "expenses":
        return const ExpensesLedgerView();
      case "settings":
        return const SettingsView();
      default:
        return const SizedBox();
    }
  }

  void _showUnlockDialog(BuildContext context, BillingProvider bp, String panel) {
    final codeCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text("Challenge Authorization Code", style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: codeCtrl,
          keyboardType: TextInputType.number,
          obscureText: true,
          decoration: const InputDecoration(labelText: "Enter admin security code"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () {
              if (bp.challengePanelPin(codeCtrl.text, panel)) {
                Navigator.pop(ctx);
                setState(() => _activeTab = "dashboard");
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Unauthorized passcode pin")),
                );
              }
            },
            child: const Text("Challenge"),
          )
        ],
      ),
    );
  }
}


// -----------------------------------------------------------------
// 3. SCREEN MODULES: DASHBOARD VIEW (ADMIN ONLY)
// -----------------------------------------------------------------

class DashboardView extends StatelessWidget {
  const DashboardView({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "Showroom Strategic Overview",
              style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
            ),
            DropdownButton<DateRangeFilter>(
              value: bp.activeFilter,
              dropdownColor: const Color(0xFF0C111D),
              style: const TextStyle(color: Colors.white),
              onChanged: (v) {}, // Trigger custom filter change
              items: const [
                DropdownMenuItem(value: DateRangeFilter.daily, child: Text("Daily Summary")),
                DropdownMenuItem(value: DateRangeFilter.weekly, child: Text("Weekly Overview")),
                DropdownMenuItem(value: DateRangeFilter.monthly, child: Text("Monthly Report")),
                DropdownMenuItem(value: DateRangeFilter.yearly, child: Text("Yearly Balance Sheet")),
              ],
            ),
          ],
        ),
        const SizedBox(height: 32),
        
        // Bento-grid dashboard overview reporting metrics cards
        Row(
          children: [
            _cardMetric("Daily Sales", "৳ 1,45,000", Colors.emerald, Icons.trending_up),
            const SizedBox(width: 16),
            _cardMetric("Showroom Purchases", "৳ 90,000", Colors.blue, Icons.inventory),
            const SizedBox(width: 16),
            _cardMetric("Overheads outgoings", "৳ 15,000", Colors.orange, Icons.money_off),
            const SizedBox(width: 16),
            _cardMetric("Net Profit/Loss", "৳ 40,000", Colors.amber, Icons.pie_chart),
          ],
        )
      ],
    );
  }

  Widget _cardMetric(String title, String val, Color highlightColor, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFF1E293B)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(color: Colors.grey, fontSize: 13)),
                Icon(icon, color: highlightColor, size: 20),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              val,
              style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold, fontFamily: "JetBrains Mono"),
            )
          ],
        ),
      ),
    );
  }
}


// -----------------------------------------------------------------
// 4. SCREEN MODULES: POS AT COUNTER & WORDS FORMAT CONVERTER
// -----------------------------------------------------------------

class SalesCounterView extends StatefulWidget {
  const SalesCounterView({Key? key}) : super(key: key);

  @override
  _SalesCounterViewState createState() => _SalesCounterViewState();
}

class _SalesCounterViewState extends State<SalesCounterView> {
  final _invoiceCtrl = TextEditingController(text: "INV-667799");
  final _searchProductCtrl = TextEditingController();
  final _searchCustomerCtrl = TextEditingController();
  
  String _productQuery = "";
  String _customerQuery = "";
  bool _showCustomersDropdown = false;

  @override
  void initState() {
    super.initState();
    _invoiceCtrl.text = "INV-${DateTime.now().microsecondsSinceEpoch.toString().substring(10)}";
  }

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    // Dynamic search lists inside Sales Counter using instant contains search (Fuzzy Search option)
    final matchingProducts = bp.products.where((p) {
      final q = _productQuery.toLowerCase().trim();
      if (q.isEmpty) return true;
      final target = "${p.name} ${p.sku ?? ''} ${p.category}".toLowerCase();
      return q.split(' ').every((word) => target.contains(word));
    }).toList();

    final matchingCustomers = bp.customers.where((c) {
      final q = _customerQuery.toLowerCase().trim();
      if (q.isEmpty) return true;
      final target = "${c.name} ${c.phone} ${c.address ?? ''}".toLowerCase();
      return q.split(' ').every((word) => target.contains(word));
    }).toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // LEFT COLUMN: Product Selector & Customer Registration Bindings
          Expanded(
            flex: 5,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Point-of-Sale Register",
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),

                // 1. Customer binding selector
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "SELECT CUSTOMER (FUZZY SEARCH)",
                            style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          TextField(
                            controller: _searchCustomerCtrl,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            onChanged: (val) {
                              setState(() {
                                _customerQuery = val;
                                _showCustomersDropdown = true;
                              });
                            },
                            onTap: () {
                              setState(() {
                                _showCustomersDropdown = true;
                              });
                            },
                            decoration: InputDecoration(
                              hintText: bp.selectedCartCustomer != null 
                                ? "Selected: ${bp.selectedCartCustomer!.name} (${bp.selectedCartCustomer!.phone})"
                                : "Search or type to filter existing customers...",
                              hintStyle: TextStyle(
                                color: bp.selectedCartCustomer != null ? Colors.amber : Colors.grey[600],
                                fontSize: 12,
                              ),
                              suffixIcon: bp.selectedCartCustomer != null
                                ? IconButton(
                                    icon: const Icon(Icons.clear, color: Colors.rose, size: 16),
                                    onPressed: () {
                                      bp.configureCartBilling(client: null);
                                      _searchCustomerCtrl.clear();
                                      setState(() {
                                        _customerQuery = "";
                                        _showCustomersDropdown = false;
                                      });
                                    },
                                  )
                                : const Icon(Icons.arrow_drop_down, color: Colors.grey),
                              filled: true,
                              fillColor: const Color(0xFF0F172A),
                              enabledBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: Color(0xFF1E293B)),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: Colors.amber),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Customer dropdown overlay matching searches
                if (_showCustomersDropdown && _customerQuery.isNotEmpty)
                  Container(
                    constraints: const BoxConstraints(maxHeight: 180),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF1E293B)),
                    ),
                    child: matchingCustomers.isEmpty
                        ? const ListTile(
                            title: Text("No customers matched fuzzy search", style: TextStyle(color: Colors.grey, fontSize: 13)),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            itemCount: matchingCustomers.length,
                            itemBuilder: (context, cIdx) {
                              final c = matchingCustomers[cIdx];
                              return ListTile(
                                dense: true,
                                title: Text(c.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                subtitle: Text(c.phone, style: const TextStyle(color: Colors.grey)),
                                onTap: () {
                                  bp.configureCartBilling(client: c);
                                  _searchCustomerCtrl.text = c.name;
                                  setState(() {
                                    _showCustomersDropdown = false;
                                  });
                                },
                              );
                            },
                          ),
                  ),

                const SizedBox(height: 12),

                // 2. Product Search & Grid Panel Selection
                const Text(
                  "SEARCH PRODUCTS (FUZZY)",
                  style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _searchProductCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  onChanged: (val) {
                    setState(() {
                      _productQuery = val;
                    });
                  },
                  decoration: InputDecoration(
                    hintText: "Type name/SKU/letter (e.g. 'a') to filter instantly...",
                    hintStyle: TextStyle(color: Colors.grey[500], fontSize: 12),
                    prefixIcon: const Icon(Icons.search, color: Colors.grey, size: 18),
                    filled: true,
                    fillColor: const Color(0xFF0F172A),
                    enabledBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFF1E293B)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Colors.amber),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                ),
                const SizedBox(height: 12),

                // Dynamic grid of matching products search items
                Expanded(
                  child: matchingProducts.isEmpty
                      ? const Center(child: Text("No items match instant filter", style: TextStyle(color: Colors.grey)))
                      : GridView.builder(
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            childAspectRatio: 1.1,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                          ),
                          itemCount: matchingProducts.length,
                          itemBuilder: (ctx, pIdx) {
                            final p = matchingProducts[pIdx];
                            final bool hasNegativeStock = p.stock <= 0;
                            
                            return InkWell(
                              onTap: () {
                                bp.addToCart(p, 1, p.sellPrice);
                                ScaffoldMessenger.of(context).clearSnackBars();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    duration: const Duration(milliseconds: 500),
                                    content: Text("Added ${p.name} to cart basket"),
                                  ),
                                );
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: hasNegativeStock ? const Color(0xFFFF3333) : const Color(0xFF1E293B),
                                    width: hasNegativeStock ? 1.5 : 1.0,
                                  ),
                                ),
                                padding: const EdgeInsets.all(10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      p.name,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          "৳ ${p.sellPrice}",
                                          style: const TextStyle(color: Colors.emerald, fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                          decoration: BoxDecoration(
                                            color: hasNegativeStock ? const Color(0xFFFF3333) : Colors.amber.withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            "Stock: ${p.stock} ${p.unit}",
                                            style: TextStyle(
                                              color: hasNegativeStock ? Colors.white : Colors.amber, 
                                              fontSize: 9, 
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ],
                                    )
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 24),

          // RIGHT COLUMN: Active POS Cart Basket & Totals checkout
          Expanded(
            flex: 4,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0C111D),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF1F2937)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "Basket Lines",
                        style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      InkWell(
                        onTap: () {
                          setState(() {
                            bp.cart.clear();
                          });
                        },
                        child: const Text(
                          "Clear All",
                          style: TextStyle(color: Colors.rose, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: Colors.grey, height: 16),

                  // Cart lines
                  Expanded(
                    child: bp.cart.isEmpty
                        ? const Center(
                            child: Text("Basket is empty. Select items on left", style: TextStyle(color: Colors.grey, fontSize: 12)),
                          )
                        : ListView.builder(
                            itemCount: bp.cart.length,
                            itemBuilder: (ctx, idx) {
                              final item = bp.cart[idx];
                              final Product prod = item['product'];

                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0F172A),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFF1E293B)),
                                ),
                                child: ListTile(
                                  dense: true,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10),
                                  title: Text(prod.name, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 12)),
                                  subtitle: Text("Price: ৳ ${item['sell_price']}", style: const TextStyle(color: Colors.grey, fontSize: 10)),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove_circle, color: Colors.amber, size: 18),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(),
                                        onPressed: () => bp.updateCartQty(idx, item['quantity'] - 1),
                                      ),
                                      const SizedBox(width: 6),
                                      Text("${item['quantity']}", style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                                      const SizedBox(width: 6),
                                      IconButton(
                                        icon: const Icon(Icons.add_circle, color: Colors.amber, size: 18),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(),
                                        onPressed: () => bp.updateCartQty(idx, item['quantity'] + 1),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),

                  const Divider(color: Colors.grey),

                  // Custom discounts and calculations
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("Flat Rebates Discount", style: TextStyle(color: Colors.grey, fontSize: 12)),
                      SizedBox(
                        width: 90,
                        height: 28,
                        child: TextField(
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          onChanged: (val) {
                            final valDouble = double.tryParse(val) ?? 0.0;
                            bp.configureCartBilling(disc: valDouble);
                          },
                          decoration: InputDecoration(
                            hintText: "৳ 0",
                            hintStyle: TextStyle(color: Colors.grey[600], fontSize: 11),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                            filled: true,
                            fillColor: const Color(0xFF0F172A),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Colors.amber)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: Color(0xFF1E293B))),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  _invoiceRow("PAYABLE TOTAL", "৳ ${bp.cartGrandTotal.toStringAsFixed(1)}", bold: true, color: Colors.amber),
                  const SizedBox(height: 12),

                  // Total in words
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withOpacity(0.5),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("TOTAL IN WORDS:", style: TextStyle(color: Colors.grey, fontSize: 8, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          bp.convertToWords(bp.cartGrandTotal),
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: "JetBrains Mono"),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Invoice tag field
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("Invoice Memo No:", style: TextStyle(color: Colors.grey, fontSize: 11)),
                      SizedBox(
                        width: 120,
                        height: 24,
                        child: TextField(
                          controller: _invoiceCtrl,
                          style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  ElevatedButton(
                    onPressed: () async {
                      if (bp.cart.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("Cannot cashout an empty checkout cart")),
                        );
                        return;
                      }
                      try {
                        await bp.executeCheckoutCart(_invoiceCtrl.text, null);
                        showSuccessNotification(context, "Billing receipt created & stocks synchronized");
                        setState(() {
                          _invoiceCtrl.text = "INV-${DateTime.now().microsecondsSinceEpoch.toString().substring(10)}";
                        });
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text("Error: ${e.toString()}")),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.emerald,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text("PRINT PDF & CASH OUT", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _invoiceRow(String left, String right, {bool bold = false, Color color = Colors.white}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(left, style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(right, style: TextStyle(color: color, fontSize: bold ? 15 : 12, fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        ],
      ),
    );
  }
}


// -----------------------------------------------------------------
// 5. SCREEN MODULES: MINUS STOCK OUT-OF-STOCK TRACKER
// -----------------------------------------------------------------

class MinusStockTrackerView extends StatelessWidget {
  const MinusStockTrackerView({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Minus Stock Items Dashboard", style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        const Text("Trace items sold into negative inventory. When supply cost is changed, the database automatically corrects profit values.", style: TextStyle(color: Colors.grey, fontSize: 13)),
        const SizedBox(height: 24),

        Expanded(
          child: ListView(
            children: [
              ListTile(
                title: const Text("Samsung Air Conditioner Inverter 1.5 Ton", style: TextStyle(color: Colors.white)),
                subtitle: const Text("Sold on INV-990033 | Customer: Mohammad Aminul", style: TextStyle(color: Colors.grey)),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF3333), // Solid Static Coral Premium Red Alert badge
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    "Negative 2 pcs",
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
              )
            ],
          ),
        )
      ],
    );
  }
}


// -----------------------------------------------------------------
// 6. SCREEN MODULES: PRODUCTS CATALOG ADD / EDIT
// -----------------------------------------------------------------

class ProductsCatalogView extends StatefulWidget {
  const ProductsCatalogView({Key? key}) : super(key: key);

  @override
  _ProductsCatalogViewState createState() => _ProductsCatalogViewState();
}

class _ProductsCatalogViewState extends State<ProductsCatalogView> {
  final _searchCtrl = TextEditingController();
  String _searchQuery = "";

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    // Instant Contains Fuzzy Search algorithm
    final filtered = bp.products.where((p) {
      final q = _searchQuery.toLowerCase().trim();
      if (q.isEmpty) return true;
      final target = "${p.name} ${p.sku ?? ''} ${p.category}".toLowerCase();
      return q.split(' ').every((word) => target.contains(word));
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "Product Registry",
              style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
            ),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: () {
                    _showAddProductDialog(context, bp);
                  },
                  icon: const Icon(Icons.add_box, color: Colors.black, size: 16),
                  label: const Text(
                    "ADD NEW PRODUCT",
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    "Total: ${filtered.length} items",
                    style: const TextStyle(color: Colors.amber, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 16),
        
        // High-performance Contains instant search
        TextField(
          controller: _searchCtrl,
          style: const TextStyle(color: Colors.white),
          onChanged: (val) {
            setState(() {
              _searchQuery = val;
            });
          },
          decoration: InputDecoration(
            hintText: "Instant search by name, SKU, or category (e.g. type 'a' to filter)...",
            hintStyle: TextStyle(color: Colors.grey[500], fontSize: 14),
            prefixIcon: const Icon(Icons.search, color: Colors.grey),
            filled: true,
            fillColor: const Color(0xFF0F172A),
            enabledBorder: OutlineInputBorder(
              borderSide: const BorderSide(color: Color(0xFF1E293B)),
              borderRadius: BorderRadius.circular(12),
            ),
            focusedBorder: OutlineInputBorder(
              borderSide: const BorderSide(color: Colors.amber),
              borderRadius: BorderRadius.circular(12),
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 0),
          ),
        ),
        const SizedBox(height: 16),

        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Text(
                    _searchQuery.isEmpty ? "No products in database" : "No products matching '$_searchQuery'",
                    style: const TextStyle(color: Colors.grey),
                  ),
                )
              : GridView.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    childAspectRatio: 0.75,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                  ),
                  itemCount: filtered.length,
                  itemBuilder: (ctx, idx) {
                    final prod = filtered[idx];
                    final bool isLowStock = prod.stock <= 0;
                    
                    return Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isLowStock ? const Color(0xFFFF3333) : const Color(0xFF1E293B),
                          width: isLowStock ? 1.5 : 1.0,
                        ),
                      ),
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Container(
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: (prod.imageUrl != null && prod.imageUrl!.isNotEmpty && prod.imageUrl!.startsWith('http'))
                                    ? Image.network(
                                        prod.imageUrl!,
                                        fit: BoxFit.cover,
                                        errorBuilder: (context, error, stackTrace) {
                                          return const Center(
                                            child: Icon(Icons.broken_image, size: 40, color: Colors.grey),
                                          );
                                        },
                                      )
                                    : const Center(
                                        child: Icon(Icons.image, size: 40, color: Colors.grey),
                                      ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            prod.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "SKU: ${prod.sku ?? 'N/A'}",
                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: isLowStock ? const Color(0xFFFF3333) : Colors.amber.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  "Stock: ${prod.stock} ${prod.unit}",
                                  style: TextStyle(
                                    color: isLowStock ? Colors.white : Colors.amber, 
                                    fontSize: 9, 
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              Text(
                                "৳ ${prod.sellPrice}",
                                style: const TextStyle(color: Colors.emerald, fontWeight: FontWeight.bold, fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        )
      ],
    );
  }
}


// -----------------------------------------------------------------
// 7. SCREEN MODULES: SUPPLY PURCHASES LOG
// -----------------------------------------------------------------

class PurchasesLedgerView extends StatefulWidget {
  const PurchasesLedgerView({Key? key}) : super(key: key);

  @override
  _PurchasesLedgerViewState createState() => _PurchasesLedgerViewState();
}

class _PurchasesLedgerViewState extends State<PurchasesLedgerView> {
  final _invoiceCtrl = TextEditingController();
  final _searchProductCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _rateCtrl = TextEditingController();

  Product? _selectedProduct;
  String _productQuery = "";
  bool _showProductDropdown = false;

  @override
  void initState() {
    super.initState();
    _invoiceCtrl.text = "PUR-${DateTime.now().microsecondsSinceEpoch.toString().substring(11)}";
  }

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    final matchingProducts = bp.products.where((p) {
      final q = _productQuery.toLowerCase().trim();
      if (q.isEmpty) return true;
      final target = "${p.name} ${p.sku ?? ''}".toLowerCase();
      return q.split(' ').every((word) => target.contains(word));
    }).toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 4,
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Log Supply Voucher", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),

                  TextField(
                    controller: _invoiceCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Purchase Invoice Number"),
                  ),
                  const SizedBox(height: 12),

                  const Text("SELECT PRODUCT (FUZZY SEARCH)", style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _searchProductCtrl,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    onChanged: (val) {
                      setState(() {
                        _productQuery = val;
                        _showProductDropdown = true;
                      });
                    },
                    onTap: () {
                      setState(() {
                        _showProductDropdown = true;
                      });
                    },
                    decoration: InputDecoration(
                      hintText: _selectedProduct != null 
                        ? "Selected: ${_selectedProduct!.name}"
                        : "Type name or short keywords...",
                      hintStyle: TextStyle(
                        color: _selectedProduct != null ? Colors.amber : Colors.grey[600],
                        fontSize: 12,
                      ),
                      suffixIcon: _selectedProduct != null
                        ? IconButton(
                            icon: const Icon(Icons.clear, color: Colors.rose, size: 16),
                            onPressed: () {
                              setState(() {
                                _selectedProduct = null;
                                _searchProductCtrl.clear();
                                _productQuery = "";
                              });
                            },
                          )
                        : const Icon(Icons.arrow_drop_down, color: Colors.grey),
                      filled: true,
                      fillColor: const Color(0xFF1E293B),
                      enabledBorder: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(10)),
                      focusedBorder: OutlineInputBorder(borderSide: const BorderSide(color: Colors.amber), borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    ),
                  ),

                  if (_showProductDropdown && _productQuery.isNotEmpty)
                    Container(
                      constraints: const BoxConstraints(maxHeight: 180),
                      margin: const EdgeInsets.only(top: 4, bottom: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF334155)),
                      ),
                      child: matchingProducts.isEmpty
                          ? const ListTile(title: Text("No products match", style: TextStyle(color: Colors.grey, fontSize: 12)))
                          : ListView.builder(
                              shrinkWrap: true,
                              itemCount: matchingProducts.length,
                              itemBuilder: (ctx, idx) {
                                final p = matchingProducts[idx];
                                return ListTile(
                                  dense: true,
                                  title: Text(p.name, style: const TextStyle(color: Colors.white, fontSize: 12)),
                                  subtitle: Text("Current Stock: ${p.stock}", style: const TextStyle(color: Colors.grey, fontSize: 10)),
                                  onTap: () {
                                    setState(() {
                                      _selectedProduct = p;
                                      _searchProductCtrl.text = p.name;
                                      _showProductDropdown = false;
                                    });
                                  },
                                );
                              },
                            ),
                    ),

                  const SizedBox(height: 12),
                  TextField(
                    controller: _qtyCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Quantity (Supply Pieces)"),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _rateCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Cost Buy Price per Unit (৳)"),
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (_selectedProduct == null || _qtyCtrl.text.isEmpty || _rateCtrl.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("All parameters and product selection are requested")),
                          );
                          return;
                        }
                        final double qty = double.tryParse(_qtyCtrl.text) ?? 0.0;
                        final double rate = double.tryParse(_rateCtrl.text) ?? 0.0;
                        if (qty <= 0 || rate <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Quantity and rate should be greater than zero")),
                          );
                          return;
                        }
                        try {
                          await bp.logNewPurchase(_invoiceCtrl.text, _selectedProduct!.id, qty, rate);
                          _qtyCtrl.clear();
                          _rateCtrl.clear();
                          setState(() {
                            _selectedProduct = null;
                            _searchProductCtrl.clear();
                            _productQuery = "";
                            _invoiceCtrl.text = "PUR-${DateTime.now().microsecondsSinceEpoch.toString().substring(11)}";
                          });
                          showSuccessNotification(context, "Purchase supply logged & inventory stocks synchronized");
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e")));
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text("SAVE SUPPLY VOUCHER", style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
          ),
        ),

        const SizedBox(width: 24),

        Expanded(
          flex: 6,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("Supply Vouchers Journal", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),

              Expanded(
                child: bp.purchases.isEmpty
                    ? const Center(child: Text("No supply logs in this store", style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        itemCount: bp.purchases.length,
                        itemBuilder: (ctx, idx) {
                          final p = bp.purchases[idx];
                          final associatedProduct = bp.products.firstWhere((prod) => prod.id == p.productId, orElse: () => Product(id: '', ownerId: '', name: 'Deleted Brand Product', category: '', buyPrice: 0, sellPrice: 0, stock: 0, unit: ''));

                          return Card(
                            color: const Color(0xFF0F172A),
                            margin: const EdgeInsets.only(bottom: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: Color(0xFF1E293B)),
                            ),
                            child: ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: Color(0xFF1E293B),
                                child: Icon(Icons.add_business, color: Colors.amber, size: 20),
                              ),
                              title: Text(associatedProduct.name, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                "INV: ${p.invoiceNo} | Qty: ${p.quantity} | Cost: ৳ ${p.buyPrice}", 
                                style: const TextStyle(color: Colors.grey, fontSize: 10),
                              ),
                              trailing: Text(
                                "৳ ${(p.quantity * p.buyPrice).toStringAsFixed(0)}", 
                                style: const TextStyle(color: Colors.emerald, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}


// -----------------------------------------------------------------
// 8. SCREEN MODULES: CUSTOMERS DATABASE CRM
// -----------------------------------------------------------------

class CustomersListView extends StatefulWidget {
  const CustomersListView({Key? key}) : super(key: key);

  @override
  _CustomersListViewState createState() => _CustomersListViewState();
}

class _CustomersListViewState extends State<CustomersListView> {
  final _searchCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  
  String _searchQuery = "";

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    // Instant Contains Fuzzy Search filter
    final filtered = bp.customers.where((c) {
      final q = _searchQuery.toLowerCase().trim();
      if (q.isEmpty) return true;
      final target = "${c.name} ${c.phone} ${c.address ?? ''}".toLowerCase();
      return q.split(' ').every((word) => target.contains(word));
    }).toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 4,
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Add Customer Account", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _nameCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Customer Name", suffixIcon: Icon(Icons.person, color: Colors.grey)),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Mobile Number", suffixIcon: Icon(Icons.phone, color: Colors.grey)),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _addressCtrl,
                    maxLines: 2,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Living Address Location"),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (_nameCtrl.text.isEmpty || _phoneCtrl.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Name and mobile phone values are requested")),
                          );
                          return;
                        }
                        try {
                          await bp.registerCustomerDetails(_nameCtrl.text, _phoneCtrl.text, _addressCtrl.text);
                          _nameCtrl.clear();
                          _phoneCtrl.clear();
                          _addressCtrl.clear();
                          showSuccessNotification(context, "Customer profile registered successfully");
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text("Error: $e")),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text("SAVE CUSTOMER FILE", style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
          ),
        ),

        const SizedBox(width: 24),

        Expanded(
          flex: 6,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("Customers Database Index", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              
              TextField(
                controller: _searchCtrl,
                style: const TextStyle(color: Colors.white),
                onChanged: (v) => setState(() => _searchQuery = v),
                decoration: InputDecoration(
                  hintText: "Instant search customer phone/name...",
                  prefixIcon: const Icon(Icons.search, color: Colors.grey),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  enabledBorder: OutlineInputBorder(
                    borderSide: const BorderSide(color: Color(0xFF1E293B)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: const BorderSide(color: Colors.amber),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const SizedBox(height: 16),

              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text("No customers match search query", style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (ctx, idx) {
                          final c = filtered[idx];
                          return Card(
                            color: const Color(0xFF0F172A),
                            margin: const EdgeInsets.only(bottom: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: Color(0xFF1E293B)),
                            ),
                            child: ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: Color(0xFF1E293B),
                                child: Icon(Icons.person, color: Colors.amber),
                              ),
                              title: Text(c.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.phone, style: const TextStyle(color: Colors.grey)),
                                  if (c.address != null && c.address!.isNotEmpty)
                                    Text(c.address!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                ],
                              ),
                              trailing: Icon(Icons.chevron_right, color: Colors.grey[600]),
                            ),
                          );
                        },
                      ),
              )
            ],
          ),
        ),
      ],
    );
  }
}


// -----------------------------------------------------------------
// 9. SCREEN MODULES: OVERHEAD EXPENSES VOUCHER LEDGER
// -----------------------------------------------------------------

class ExpensesLedgerView extends StatefulWidget {
  const ExpensesLedgerView({Key? key}) : super(key: key);

  @override
  _ExpensesLedgerViewState createState() => _ExpensesLedgerViewState();
}

class _ExpensesLedgerViewState extends State<ExpensesLedgerView> {
  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  
  String _selectedCategory = "Shop Rent";
  String _activeFilterCategory = "All";

  final List<String> _categories = [
    "Shop Rent",
    "Electric Bill",
    "Staff Salary",
    "Entertainment",
    "Others"
  ];

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    final filtered = bp.expenses.where((e) {
      if (_activeFilterCategory == "All") return true;
      return e.category == _activeFilterCategory;
    }).toList();

    final double totalOverheads = filtered.fold(0.0, (sum, item) => sum + item.amount);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 4,
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Log Overhead Expense", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 20),
                  
                  const Text("EXPENSE CATEGORY", style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedCategory,
                        dropdownColor: const Color(0xFF0C111D),
                        icon: const Icon(Icons.arrow_drop_down, color: Colors.amber),
                        isExpanded: true,
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                        onChanged: (newVal) {
                          if (newVal != null) {
                            setState(() {
                              _selectedCategory = newVal;
                            });
                          }
                        },
                        items: _categories.map((String cat) {
                          return DropdownMenuItem<String>(
                            value: cat,
                            child: Text(cat),
                          );
                        }).toList(),
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),
                  
                  TextField(
                    controller: _descCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: "Voucher Description Notes",
                      hintText: "e.g. Electric overhead premises bill...",
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _amountCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      labelText: "Overhead Cost (৳ Taka)",
                      prefixText: "৳ ",
                    ),
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (_descCtrl.text.isEmpty || _amountCtrl.text.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Description and amount fields are required")),
                          );
                          return;
                        }
                        final double amt = double.tryParse(_amountCtrl.text) ?? 0.0;
                        if (amt <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Price should be greater than zero")),
                          );
                          return;
                        }
                        try {
                          await bp.logExpenseVoucher(_descCtrl.text, _selectedCategory, amt);
                          _descCtrl.clear();
                          _amountCtrl.clear();
                          showSuccessNotification(context, "Expense logged in ledger successfully");
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text("Error: $e")),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text("COMMIT VOUCHER", style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                    ),
                  )
                ],
              ),
            ),
          ),
        ),

        const SizedBox(width: 24),

        Expanded(
          flex: 6,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Expense Transactions Journal", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "Sum: ৳ ${totalOverheads.toStringAsFixed(0)}",
                      style: const TextStyle(color: Colors.amber, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ["All", ..._categories].map((String filterCat) {
                    final bool isSelected = _activeFilterCategory == filterCat;
                    return Container(
                      margin: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(filterCat),
                        selected: isSelected,
                        selectedColor: Colors.amber,
                        backgroundColor: const Color(0xFF0F172A),
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.black : Colors.white, 
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 11,
                        ),
                        onSelected: (bool selected) {
                          if (selected) {
                            setState(() {
                              _activeFilterCategory = filterCat;
                            });
                          }
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),

              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text("No ledger entries logged in this category", style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        itemCount: filtered.length,
                        itemBuilder: (ctx, idx) {
                          final e = filtered[idx];
                          
                          IconData catIcon = Icons.money;
                          if (e.category == "Shop Rent") catIcon = Icons.home;
                          if (e.category == "Electric Bill") catIcon = Icons.lightbulb;
                          if (e.category == "Staff Salary") catIcon = Icons.people;
                          if (e.category == "Entertainment") catIcon = Icons.fastfood;

                          return Card(
                            color: const Color(0xFF0F172A),
                            margin: const EdgeInsets.only(bottom: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: Color(0xFF1E293B)),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: const Color(0xFF1E293B),
                                child: Icon(catIcon, color: Colors.amber, size: 20),
                              ),
                              title: Text(e.description, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                "${e.category} | ${e.createdAt.toLocal().toString().split(' ')[0]}", 
                                style: const TextStyle(color: Colors.grey, fontSize: 10),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    "- ৳ ${e.amount.toStringAsFixed(0)}", 
                                    style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton(
                                    icon: const Icon(Icons.delete, color: Colors.rose, size: 16),
                                    onPressed: () => bp.deleteExpenseVoucher(e.id),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}


// -----------------------------------------------------------------
// 10. SCREEN MODULES: SYSTEM CONFIGURATION & FONT SCALING
// -----------------------------------------------------------------

class SettingsView extends StatefulWidget {
  const SettingsView({Key? key}) : super(key: key);

  @override
  _SettingsViewState createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  final _adminPassCtrl = TextEditingController();
  final _salesPassCtrl = TextEditingController();
  bool _initialized = false;

  @override
  void dispose() {
    _adminPassCtrl.dispose();
    _salesPassCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);
    if (!_initialized && bp.profile != null) {
      _adminPassCtrl.text = bp.profile!.adminPasscode;
      _salesPassCtrl.text = bp.profile!.salesPasscode;
      _initialized = true;
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("System Configuration Control", style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text("Configure typography dynamic dimensions, security PIN locks, and showroom details.", style: TextStyle(color: Colors.grey, fontSize: 13)),
            const SizedBox(height: 32),

            // 1. TYPOGRAPHY SCALING SECTION
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.text_fields, color: Colors.amber, size: 24),
                      SizedBox(width: 12),
                      Text("Global Typography Scale", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "Select screen letters scale factor. Adjustments immediately scale menus, checkout fields, and invoice texts globally without a restart.",
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 20),

                  Row(
                    children: ["Regular", "Medium", "Large"].map((String scale) {
                      final bool isSelected = bp.fontSizeScale == scale;
                      return Container(
                        margin: const EdgeInsets.only(right: 12),
                        child: ChoiceChip(
                          label: Text(scale),
                          selected: isSelected,
                          selectedColor: Colors.amber,
                          backgroundColor: const Color(0xFF1E293B),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.black : Colors.white,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            fontSize: 13,
                          ),
                          onSelected: (bool selected) {
                            if (selected) {
                              bp.saveFontSizeScale(scale);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  duration: const Duration(milliseconds: 500),
                                  content: Text("Font scaling adjusted to: $scale"),
                                ),
                              );
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 2. SECURITY CREDENTIALS
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.security, color: Colors.amber, size: 24),
                      SizedBox(width: 12),
                      Text("Security Lock Authentication", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    title: const Text("Admin Passcode PIN", style: TextStyle(color: Colors.white, fontSize: 14)),
                    subtitle: const Text("Standard code to open sales summary reports & cost edit panels", style: TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Chip(
                      label: Text(bp.profile?.adminPasscode ?? "1234"),
                      backgroundColor: const Color(0xFF1E293B),
                    ),
                  ),
                  const Divider(color: Color(0xFF1E293B)),
                  ListTile(
                    title: const Text("Cashier Counter PIN", style: TextStyle(color: Colors.white, fontSize: 14)),
                    subtitle: const Text("Standard code to enter sales billing screen environment", style: TextStyle(color: Colors.grey, fontSize: 12)),
                    trailing: Chip(
                      label: Text(bp.profile?.salesPasscode ?? "5555"),
                      backgroundColor: const Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 3. STORE IDENTITY INFO
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF1E293B)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.storefront, color: Colors.amber, size: 24),
                      SizedBox(width: 12),
                      Text("Store Outlet Configs", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _outletRow("Showroom Name", bp.profile?.shopName ?? "Barakah Electronics"),
                  _outletRow("Billing Locality Address", bp.profile?.shopAddress ?? "Dhaka Stadium Market, Dhaka"),
                  _outletRow("Outlet Phone Line", bp.profile?.supportPhone ?? "01700-000000"),
                  _outletRow("Local Currency Code", bp.profile?.currencySymbol ?? "৳ BDT"),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 4. PANEL PASSWORD SECURITY BLOCK (Restricted to Admin view only by default settings tab restriction)
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: bp.isPasscodeConfigured ? const Color(0xFF1E293B) : Colors.redAccent.withOpacity(0.4),
                  width: bp.isPasscodeConfigured ? 1.0 : 2.0,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.lock_reset, color: Colors.amber, size: 24),
                      const SizedBox(width: 12),
                      const Text(
                        "Panel Password Security",
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const Spacer(),
                      if (!bp.isPasscodeConfigured)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.redAccent, width: 1),
                          ),
                          child: const Text(
                            "INSECURE / UNSET",
                            style: TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "Set secure numeric passcodes for Admin panel authorization and the standard Cashier Counter login.",
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 20),

                  // Admin passcode input
                  TextField(
                    controller: _adminPassCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white, fontFamily: "JetBrains Mono"),
                    decoration: InputDecoration(
                      labelText: "Set/Change Admin Password",
                      labelStyle: const TextStyle(color: Colors.grey, fontSize: 13),
                      enabledBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Color(0xFF1F2937)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.amber),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Sales passcode input
                  TextField(
                    controller: _salesPassCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white, fontFamily: "JetBrains Mono"),
                    decoration: InputDecoration(
                      labelText: "Set/Change Sales Password",
                      labelStyle: const TextStyle(color: Colors.grey, fontSize: 13),
                      enabledBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Color(0xFF1F2937)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.amber),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                  const SizedBox(height: 20),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () async {
                        final String admin = _adminPassCtrl.text.trim();
                        final String sales = _salesPassCtrl.text.trim();

                        if (admin.isEmpty || sales.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("Passcodes cannot be empty."),
                              backgroundColor: Colors.rose,
                            ),
                          );
                          return;
                        }

                        if (admin == "1234" || sales == "5555" || admin == "unset" || sales == "unset") {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("Please choose passwords other than system defaults."),
                              backgroundColor: Colors.rose,
                            ),
                          );
                          return;
                        }

                        if (admin == sales) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("Admin and Sales passcodes must be different for security boundaries."),
                              backgroundColor: Colors.rose,
                            ),
                          );
                          return;
                        }

                        try {
                          await bp.updatePasscodes(admin, sales);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("Security Passwords updated successfully! Locks are instantly active."),
                              backgroundColor: Colors.emerald,
                            ),
                          );
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text("Failed to update passwords: ${e.toString()}"),
                              backgroundColor: Colors.rose,
                            ),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: bp.isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2),
                            )
                          : const Text(
                              "Update Security Passwords",
                              style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                            ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // 5. DANGER ZONE / WIPE WORKSPACE COMPLETELY
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.redAccent.withOpacity(0.3), width: 1.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: const [
                      Icon(Icons.dangerous, color: Colors.rose, size: 24),
                      SizedBox(width: 12),
                      Text("Danger Zone (Reset Workspace)", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "Wipe out all database entries forever. This will delete all products, purchase invoices, customer directories, expense logs, and checkout receipts.",
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                  const SizedBox(height: 20),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        _showWipeDatabaseConfirmDialog(context, bp);
                      },
                      icon: const Icon(Icons.delete_forever, color: Colors.white, size: 18),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red[800],
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      label: const Text(
                        "RESET SYSTEM DATA & WORKSPACE",
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showWipeDatabaseConfirmDialog(BuildContext context, BillingProvider bp) {
    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          backgroundColor: const Color(0xFF0C111D),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF1F2937), width: 1.5),
          ),
          child: Container(
            width: 400,
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 48),
                const SizedBox(height: 16),
                const Text(
                  "Confirm System Data Purge",
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                const Text(
                  "Are you absolutely sure you want to clean, reset and delete all product items, customer catalogs, transaction ledger histories, and invoices from this system forever? This action is irreversible.",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text("CANCEL", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          Navigator.pop(ctx);
                          try {
                            await bp.purgeData(false);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("Database wiped and reset successfully! Logged out."),
                                backgroundColor: Colors.emerald,
                              ),
                            );
                          } catch (e) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text("Reset failed: ${e.toString()}"),
                                backgroundColor: Colors.rose,
                              ),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red[800],
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text("PURGE ALL DATA", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _outletRow(String key, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(key, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Text(val, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}


// Extension helper on widget padding to keep views organized
extension WidgetPadding on Widget {
  Widget paddingOnly({double bottom = 0}) {
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: this,
    );
  }
}

// -----------------------------------------------------------------
// DYNAMIC HIGH-PERFORMANCE PRODUCT CREATION MODAL
// -----------------------------------------------------------------

void _showAddProductDialog(BuildContext context, BillingProvider bp) {
  final nameCtrl = TextEditingController();
  final skuCtrl = TextEditingController();
  final catCtrl = TextEditingController();
  final buyCtrl = TextEditingController();
  final sellCtrl = TextEditingController();
  final stockCtrl = TextEditingController();
  final unitCtrl = TextEditingController(text: "Pcs");

  showDialog(
    context: context,
    builder: (ctx) {
      return Dialog(
        backgroundColor: const Color(0xFF0C111D),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFF1F2937), width: 1.5),
        ),
        child: Container(
          width: 440,
          padding: const EdgeInsets.all(32),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.add_circle_outline, color: Colors.amber, size: 24),
                    const SizedBox(width: 12),
                    const Text(
                      "Register New Product",
                      style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.grey, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const Divider(color: Color(0xFF1F2937), height: 24),
                
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: _dialogInputStyle("Product Name (e.g., LED Smart TV)"),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: skuCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: _dialogInputStyle("SKU / Model Number"),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: catCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: _dialogInputStyle("Category (e.g., Television, AC)"),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: buyCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white),
                        decoration: _dialogInputStyle("Buy Cost (৳)"),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: sellCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white),
                        decoration: _dialogInputStyle("Sell Price (৳)"),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: stockCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white),
                        decoration: _dialogInputStyle("Initial Stock"),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: unitCtrl,
                        style: const TextStyle(color: Colors.white),
                        decoration: _dialogInputStyle("Unit (e.g., Pcs)"),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 28),
                ElevatedButton(
                  onPressed: () async {
                    final name = nameCtrl.text.trim();
                    final sku = skuCtrl.text.trim().isEmpty ? "SKU-${DateTime.now().millisecond}" : skuCtrl.text.trim();
                    final cat = catCtrl.text.trim().isEmpty ? "Electronics" : catCtrl.text.trim();
                    final buy = double.tryParse(buyCtrl.text.trim()) ?? 0.0;
                    final sell = double.tryParse(sellCtrl.text.trim()) ?? 0.0;
                    final stock = double.tryParse(stockCtrl.text.trim()) ?? 0.0;
                    final unit = unitCtrl.text.trim().isEmpty ? "Pcs" : unitCtrl.text.trim();

                    if (name.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Product Name is required"), backgroundColor: Colors.rose),
                      );
                      return;
                    }

                    try {
                      await bp.addProductToCatalog(name, sku, cat, buy, sell, stock, unit);
                      Navigator.pop(ctx);
                      showSuccessNotification(context, "Product registered successfully: $name");
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("Error registering product: $e"), backgroundColor: Colors.rose),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    "SAVE PRODUCT RECORD",
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

InputDecoration _dialogInputStyle(String hint) {
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Colors.grey, fontSize: 13),
    filled: true,
    fillColor: const Color(0xFF1E293B),
    enabledBorder: OutlineInputBorder(borderSide: BorderSide.none, borderRadius: BorderRadius.circular(10)),
    focusedBorder: OutlineInputBorder(borderSide: const BorderSide(color: Colors.amber, width: 1.5), borderRadius: BorderRadius.circular(10)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
  );
}

// -----------------------------------------------------------------
// LUXURIOUS SUCCESS NOTIFICATION W/ MICROSCOPIC CHECKMARK ANIMATIONS
// -----------------------------------------------------------------

void showSuccessNotification(BuildContext context, String message) {
  OverlayState? overlayState = Overlay.of(context);
  if (overlayState == null) return;

  late OverlayEntry overlayEntry;
  overlayEntry = OverlayEntry(
    builder: (context) => Positioned(
      top: 40,
      right: 40,
      child: AnimatedCheckmarkToast(
        message: message,
        onDismiss: () {
          overlayEntry.remove();
        },
      ),
    ),
  );

  overlayState.insert(overlayEntry);
}

class AnimatedCheckmarkToast extends StatefulWidget {
  final String message;
  final VoidCallback onDismiss;

  const AnimatedCheckmarkToast({
    Key? key,
    required this.message,
    required this.onDismiss,
  }) : super(key: key);

  @override
  State<AnimatedCheckmarkToast> createState() => _AnimatedCheckmarkToastState();
}

class _AnimatedCheckmarkToastState extends State<AnimatedCheckmarkToast> with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _checkController;
  late Animation<double> _opacityAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _checkProgress;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _checkController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _opacityAnimation = CurvedAnimation(parent: _fadeController, curve: Curves.easeOut);
    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.backOut),
    );
    _checkProgress = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _checkController, curve: Curves.easeIn),
    );

    _fadeController.forward().then((_) {
      _checkController.forward();
    });

    // Auto dismiss after 2.8 seconds
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted) {
        _fadeController.reverse().then((_) {
          widget.onDismiss();
        });
      }
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _checkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacityAnimation,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
            decoration: BoxDecoration(
              color: const Color(0xFF090D16),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.emerald.withOpacity(0.4), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: Colors.emerald.withOpacity(0.1),
                  blurRadius: 15,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: Color(0xFF0F2D1F),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: AnimatedBuilder(
                      animation: _checkProgress,
                      builder: (context, child) {
                        return CustomPaint(
                          size: const Size(14, 14),
                          painter: _CheckmarkPainter(_checkProgress.value),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Text(
                  widget.message,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CheckmarkPainter extends CustomPainter {
  final double progress;

  _CheckmarkPainter(this.progress);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.emerald
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    path.moveTo(size.width * 0.15, size.height * 0.45);
    path.lineTo(size.width * 0.45, size.height * 0.75);
    path.lineTo(size.width * 0.85, size.height * 0.25);

    // Animate path drawing based on progress value
    final pms = path.computeMetrics();
    for (final pm in pms) {
      final extract = pm.extractPath(0, pm.length * progress);
      canvas.drawPath(extract, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _CheckmarkPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
