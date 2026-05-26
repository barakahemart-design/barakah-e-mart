// =========================================================================
// PRIMARY APP ENGINE STARTUP ENTRYPOINT (main.dart)
// Connects Supabase keys & boots Providers for Barakah Bill Pro.
// =========================================================================

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'billing_provider.dart';
import 'ui_screens.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Supabase using credentials
  await Supabase.initialize(
    url: 'https://rozevrnnugzrqnzwpepl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvemV2cm5udWd6cnFuendwZXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA3NTMsImV4cCI6MjA5NTAxNjc1M30.FZG-prrpGf2dyVyvSPiiuL5YhxK4XC4I27pWG0zijfI',
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => BillingProvider()),
      ],
      child: const BarakahBillApp(),
    ),
  );
}

class BarakahBillApp extends StatelessWidget {
  const BarakahBillApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);
    
    // Dynamic text scale calculation
    double scaleFactor = 1.0;
    if (bp.fontSizeScale == "Medium") {
      scaleFactor = 1.15;
    } else if (bp.fontSizeScale == "Large") {
      scaleFactor = 1.30;
    }

    return MaterialApp(
      title: "Barakah Bill Pro",
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.amber,
        scaffoldBackgroundColor: const Color(0xFF030712),
        fontFamily: 'Inter',
      ),
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaleFactor: scaleFactor,
          ),
          child: child!,
        );
      },
      home: const MainGatekeeper(),
    );
  }
}

class MainGatekeeper extends StatelessWidget {
  const MainGatekeeper({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final bp = Provider.of<BillingProvider>(context);

    // If no user profile or session exists, render login gateway screen
    if (bp.profile == null) {
      return const AuthScreen();
    }

    // Force setup if passwords not configured and not bypassed yet
    if (!bp.isPasscodeConfigured && !bp.hasBypassedSetup) {
      return const PanelPasswordSetupScreen();
    }

    // Screen lock active
    if (bp.isScreenLocked) {
      return const ScreenLockScreen();
    }

    // Otherwise render standard high-security navigation layout
    return const MainNavigationWorkspace();
  }
}
