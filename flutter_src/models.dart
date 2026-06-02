// =========================================================================
// FLUTTER MODEL DEFINITIONS FOR SMART ELECTRONICS BILLING APP
// Local models mirroring the Supabase structure with dynamic JSON encoders
// =========================================================================

import 'dart:convert';

class UserProfile {
  final String id;
  final String email;
  final String shopName;
  final String shopAddress;
  final String supportPhone;
  final String vatRegId;
  final String adminPasscode;
  final String salesPasscode;
  final String currencySymbol;
  final String? companyLogoUrl;
  final bool showLogoInInvoice;
  final String termsConditions;

  UserProfile({
    required this.id,
    required this.email,
    required this.shopName,
    required this.shopAddress,
    required this.supportPhone,
    required this.vatRegId,
    required this.adminPasscode,
    required this.salesPasscode,
    required this.currencySymbol,
    this.companyLogoUrl,
    required this.showLogoInInvoice,
    required this.termsConditions,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      shopName: json['shop_name'] ?? 'Barakah Electronics',
      shopAddress: json['shop_address'] ?? 'Dhaka, Bangladesh',
      supportPhone: json['support_phone'] ?? '01700-000000',
      vatRegId: json['vat_reg_id'] ?? '',
      adminPasscode: json['admin_passcode_hash'] ?? json['admin_panel_password'] ?? '1234',
      salesPasscode: json['sales_passcode_hash'] ?? json['sales_panel_password'] ?? '5555',
      currencySymbol: json['currency_symbol'] ?? '৳',
      companyLogoUrl: json['company_logo_url'],
      showLogoInInvoice: json['show_logo_in_invoice'] ?? true,
      termsConditions: json['terms_conditions'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'shop_name': shopName,
      'shop_address': shopAddress,
      'support_phone': supportPhone,
      'vat_reg_id': vatRegId,
      'admin_passcode_hash': adminPasscode,
      'sales_passcode_hash': salesPasscode,
      'admin_panel_password': adminPasscode,
      'sales_panel_password': salesPasscode,
      'currency_symbol': currencySymbol,
      'company_logo_url': companyLogoUrl,
      'show_logo_in_invoice': showLogoInInvoice,
      'terms_conditions': termsConditions,
    };
  }
}

class Customer {
  final String id;
  final String ownerId;
  final String name;
  final String phone;
  final String? address;
  final DateTime createdAt;

  Customer({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.phone,
    this.address,
    required this.createdAt,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      address: json['address'],
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()).toLocal(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'owner_id': ownerId,
      'name': name,
      'phone': phone,
      'address': address,
    };
  }
}

class Product {
  final String id;
  final String ownerId;
  final String name;
  final String? sku;
  final String category;
  final double buyPrice;
  final double sellPrice;
  final double stock;
  final String unit;
  final String? imageUrl;

  Product({
    required this.id,
    required this.ownerId,
    required this.name,
    this.sku,
    required this.category,
    required this.buyPrice,
    required this.sellPrice,
    required this.stock,
    required this.unit,
    this.imageUrl,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      name: json['name'] ?? '',
      sku: json['sku'],
      category: json['category'] ?? 'Electronics',
      buyPrice: (json['buy_price'] ?? 0.0).toDouble(),
      sellPrice: (json['sell_price'] ?? 0.0).toDouble(),
      stock: (json['stock'] ?? 0.0).toDouble(),
      unit: json['unit'] ?? 'piece',
      imageUrl: json['image_url'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'owner_id': ownerId,
      'name': name,
      'sku': sku,
      'category': category,
      'buy_price': buyPrice,
      'sell_price': sellPrice,
      'stock': stock,
      'unit': unit,
      'image_url': imageUrl,
    };
  }
}

class Purchase {
  final String id;
  final String ownerId;
  final String invoiceNo;
  final String productId;
  final double quantity;
  final double buyPrice;
  final DateTime createdAt;

  Purchase({
    required this.id,
    required this.ownerId,
    required this.invoiceNo,
    required this.productId,
    required this.quantity,
    required this.buyPrice,
    required this.createdAt,
  });

  factory Purchase.fromJson(Map<String, dynamic> json) {
    return Purchase(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      invoiceNo: json['invoice_no'] ?? '',
      productId: json['product_id'] ?? '',
      quantity: (json['quantity'] ?? 0.0).toDouble(),
      buyPrice: (json['buy_price'] ?? 0.0).toDouble(),
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()).toLocal(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'owner_id': ownerId,
      'invoice_no': invoiceNo,
      'product_id': productId,
      'quantity': quantity,
      'buy_price': buyPrice,
    };
  }
}

class TransactionItem {
  final String id;
  final String ownerId;
  final String transactionId;
  final String productId;
  final double quantity;
  final double sellPrice;
  final double costPrice;
  final bool isNegativeSale;

  TransactionItem({
    required this.id,
    required this.ownerId,
    required this.transactionId,
    required this.productId,
    required this.quantity,
    required this.sellPrice,
    required this.costPrice,
    required this.isNegativeSale,
  });

  factory TransactionItem.fromJson(Map<String, dynamic> json) {
    return TransactionItem(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      transactionId: json['transaction_id'] ?? '',
      productId: json['product_id'] ?? '',
      quantity: (json['quantity'] ?? 0.0).toDouble(),
      sellPrice: (json['sell_price'] ?? 0.0).toDouble(),
      costPrice: (json['cost_price'] ?? 0.0).toDouble(),
      isNegativeSale: json['is_negative_sale'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'owner_id': ownerId,
      'transaction_id': transactionId,
      'product_id': productId,
      'quantity': quantity,
      'sell_price': sellPrice,
      'cost_price': costPrice,
      'is_negative_sale': isNegativeSale,
    };
  }
}

class OrderTransaction {
  final String id;
  final String ownerId;
  final String invoiceNo;
  final String? customerId;
  final double totalAmount;
  final double discount;
  final double vatRate;
  final double paidAmount;
  final String paymentMethod;
  final String? signatureSvg;
  final DateTime createdAt;
  final List<TransactionItem> items;

  OrderTransaction({
    required this.id,
    required this.ownerId,
    required this.invoiceNo,
    this.customerId,
    required this.totalAmount,
    required this.discount,
    required this.vatRate,
    required this.paidAmount,
    required this.paymentMethod,
    this.signatureSvg,
    required this.createdAt,
    required this.items,
  });

  factory OrderTransaction.fromJson(Map<String, dynamic> json, [List<TransactionItem> lineItems = const []]) {
    return OrderTransaction(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      invoiceNo: json['invoice_no'] ?? '',
      customerId: json['customer_id'],
      totalAmount: (json['total_amount'] ?? 0.0).toDouble(),
      discount: (json['discount'] ?? 0.0).toDouble(),
      vatRate: (json['vat_rate'] ?? 0.0).toDouble(),
      paidAmount: (json['paid_amount'] ?? 0.0).toDouble(),
      paymentMethod: json['payment_method'] ?? 'Cash',
      signatureSvg: json['signature_svg'],
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()).toLocal(),
      items: lineItems,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'owner_id': ownerId,
      'invoice_no': invoiceNo,
      'customer_id': customerId,
      'total_amount': totalAmount,
      'discount': discount,
      'vat_rate': vatRate,
      'paid_amount': paidAmount,
      'payment_method': paymentMethod,
      'signature_svg': signatureSvg,
    };
  }
}

class Expense {
  final String id;
  final String ownerId;
  final String description;
  final String category;
  final double amount;
  final DateTime createdAt;

  Expense({
    required this.id,
    required this.ownerId,
    required this.description,
    required this.category,
    required this.amount,
    required this.createdAt,
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      description: json['description'] ?? '',
      category: json['category'] ?? 'Others',
      amount: (json['amount'] ?? 0.0).toDouble(),
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()).toLocal(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'owner_id': ownerId,
      'description': description,
      'category': category,
      'amount': amount,
    };
  }
}
