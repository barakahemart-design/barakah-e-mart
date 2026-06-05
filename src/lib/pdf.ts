import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Transaction, Contact, BusinessInfo } from './mockDB';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

const FONT_URLS: { [key: string]: string } = {
  "Inter": "https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-400-normal.ttf",
  "Roboto": "https://cdn.jsdelivr.net/npm/@fontsource/roboto/files/roboto-latin-400-normal.ttf",
  "Poppins": "https://cdn.jsdelivr.net/npm/@fontsource/poppins/files/poppins-latin-400-normal.ttf",
  "Open Sans": "https://cdn.jsdelivr.net/npm/@fontsource/open-sans/files/open-sans-latin-400-normal.ttf",
  "Modern Sans": "https://cdn.jsdelivr.net/npm/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.ttf",
  "Lato": "https://cdn.jsdelivr.net/npm/@fontsource/lato/files/lato-latin-400-normal.ttf",
  "Montserrat": "https://cdn.jsdelivr.net/npm/@fontsource/montserrat/files/montserrat-latin-400-normal.ttf"
};

// HELPER FUNCTION: Number to Words conversion for BDT/Tk and general currencies
function numberToWords(num: number): string {
  if (num === 0) return "ZERO TAKA ONLY";
  
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const scales = ["", "THOUSAND", "MILLION", "BILLION"];

  const helper = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " HUNDRED" + (n % 100 !== 0 ? " AND " + helper(n % 100) : "");
    return "";
  };

  let integerPart = Math.floor(num);
  let decimalPart = Math.round((num - integerPart) * 100);

  let words = "";
  let scaleIdx = 0;

  let temp = integerPart;
  while (temp > 0) {
    let chunk = temp % 1000;
    if (chunk > 0) {
      let chunkStr = helper(chunk);
      words = chunkStr + (scales[scaleIdx] ? " " + scales[scaleIdx] : "") + (words ? ", " + words : "");
    }
    temp = Math.floor(temp / 1000);
    scaleIdx++;
  }

  let result = words.trim();
  if (result) {
    result += " TAKA";
  }
  if (decimalPart > 0) {
    result += (result ? " AND " : "") + `${helper(decimalPart)} PAISA`;
  }
  return result ? result + " ONLY" : "ZERO TAKA ONLY";
}

export async function generateInvoicePDF(transaction: Transaction, contact: Contact | undefined, businessInfo: BusinessInfo) {
  const doc = new jsPDF();
  const devCurrencySymbol = businessInfo.currencySymbol === "৳" ? "TK" : businessInfo.currencySymbol;
  
  // Font Size Scaling Factor from localStorage
  const sizeSetting = localStorage.getItem("font_size_scale") || "Regular";
  let sizeFactor = 1.0;
  if (sizeSetting === "Medium") sizeFactor = 1.15;
  if (sizeSetting === "Large") sizeFactor = 1.3;

  let pdfFontName = "Helvetica";
  const userFont = businessInfo.selectedFont || "Inter";

  // Dynamic Google Font Injection
  if (FONT_URLS[userFont]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(FONT_URLS[userFont], { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const base64Font = arrayBufferToBase64(arrayBuffer);
        doc.addFileToVFS(`${userFont}.ttf`, base64Font);
        doc.addFont(`${userFont}.ttf`, userFont, "normal");
        pdfFontName = userFont;
      }
    } catch (e) {
      console.warn(`Could not load Google Font ${userFont} dynamically, falling back to Helvetica. Error:`, e);
    }
  }

  // 1. CHOOSE CORRESPONDING DESIGN VARIABLES
  const template = businessInfo.selectedInvoiceTemplate || "classic";

  let primaryColor: [number, number, number] = [15, 23, 42];        // slate-900 (Main headings/accents)
  let secondaryColor: [number, number, number] = [71, 85, 105];     // slate-600 (Meta text/labels)
  let tableHeadBg: [number, number, number] = [15, 23, 42];         // Charcoal block headers default
  let tableHeadTextColor: [number, number, number] = [255, 255, 255];
  let accentLineColor: [number, number, number] = [150, 150, 155];  // Clean dark-gray divider line
  let billToBg: [number, number, number] = [255, 255, 255];         // white background Default
  let billToBorderColor: [number, number, number] = [210, 210, 215]; // Clean border outline
  let totalsBorderColor: [number, number, number] = [15, 23, 42];    // slate-900 black border
  let totalsBg: [number, number, number] = [255, 255, 255];         // neutral white totals box

  let isVintageEditorial = false;
  let isCompactPOS = false;

  if (template === "modern_minimal") {
    // Elegant soft accents, ample whitespace, border columns
    primaryColor = [15, 23, 42];          // Slate-900
    secondaryColor = [100, 116, 139];     // Slate-500
    tableHeadBg = [241, 245, 249];        // Slate-100 neutral
    tableHeadTextColor = [15, 23, 42];    // Charcoal text
    accentLineColor = [220, 222, 225];    // Light slate divider line
    billToBg = [255, 255, 255];           // Pure white
    billToBorderColor = [220, 222, 225];  // Soft border
    totalsBorderColor = [15, 23, 42];
    totalsBg = [255, 255, 255];
  } else if (template === "premium_navy") {
    // Deep slate tones (Forced to grayscale)
    accentLineColor = [200, 200, 205];
    billToBg = [250, 250, 252];
    billToBorderColor = [200, 200, 205];
    totalsBorderColor = [15, 23, 42];
  } else if (template === "cosmic_dark") {
    // Solid dark accents (Forced to grayscale)
    accentLineColor = [15, 23, 42];
    billToBg = [250, 250, 250];
    billToBorderColor = [220, 220, 225];
    totalsBorderColor = [15, 23, 42];
  } else if (template === "vintage_editorial") {
    // Sharp academic/editorial corners (Forced to grayscale)
    accentLineColor = [15, 23, 42];
    billToBg = [255, 255, 255];
    billToBorderColor = [15, 23, 42];
    totalsBorderColor = [15, 23, 42];
    isVintageEditorial = true;
  } else if (template === "bold_emerald") {
    // Full charcoal & dark slate borders (Forced to grayscale)
    accentLineColor = [15, 23, 42];
    billToBg = [250, 250, 252];
    billToBorderColor = [200, 200, 205];
    totalsBorderColor = [15, 23, 42];
  } else if (template === "compact_pos") {
    // Ticket style (Neutral grayscale already)
    isCompactPOS = true;
  }

  let formattedDate = "N/A";
  let formattedTime = "";
  try {
    const tDate = new Date(transaction.date);
    if (!isNaN(tDate.getTime())) {
      formattedDate = format(tDate, 'dd/MM/yyyy');
      formattedTime = format(tDate, 'hh:mm a');
    }
  } catch (e) {
    // fallback
  }

  const showLogoSetting = businessInfo.showLogoInInvoice !== false;
  const companyLogoStr = businessInfo.companyLogo;
  const hasLogoImg = showLogoSetting && companyLogoStr && (companyLogoStr.startsWith("data:") || companyLogoStr.startsWith("http"));
  const hasLogoTextSymbol = showLogoSetting && companyLogoStr && !hasLogoImg && companyLogoStr.trim().length <= 3;
  const hasLogoLongText = showLogoSetting && companyLogoStr && !hasLogoImg && companyLogoStr.trim().length > 3;

  // Render Centered Brand Group: Prominent Branding Logo with Right Column Identity Information
  let identityY = 18;
  let logoWidth = 34;
  let logoHeight = 34;
  let brandX = 15;

  // Template-specific visual adjustments for logo layout
  if (template === "bold_emerald") {
    // Solid energetic black/slate brand badge horizontal strip
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, 12, 180, 2.5, 'F'); // Horizontal top bar strip
    identityY = 21;
  } else if (template === "premium_navy") {
    // Top border accent navy (turned monochromatic)
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, 12, 180, 2, 'F');
    identityY = 20;
  } else if (template === "vintage_editorial") {
    // Top double rule (turned monochromatic)
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.4);
    doc.line(15, 13, 195, 13);
    doc.line(15, 14.5, 195, 14.5);
    identityY = 21;
  }

  const hasLogoDrawn = !!(showLogoSetting && companyLogoStr && (hasLogoImg || hasLogoTextSymbol));

  const normLogo = hasLogoLongText ? (companyLogoStr || "").trim().toUpperCase() : "";
  const normBiz = (businessInfo?.name || "BARAKAH E-MART").trim().toUpperCase();
  const isSimilar = normLogo === normBiz || (normLogo && normBiz && (normLogo.startsWith(normBiz.substring(0, 6)) || normBiz.startsWith(normLogo.substring(0, 6))));

  let singleLineTitle = normBiz;
  if (hasLogoLongText) {
    if (isSimilar) {
      singleLineTitle = normLogo;
    } else {
      singleLineTitle = `${normLogo} | ${normBiz}`;
    }
  }

  const maxTitleWidth = 110; // compact readable width for details block to align nicely
  const addressLines = doc.splitTextToSize(businessInfo.address || "Showroom Address, Dhaka", maxTitleWidth);

  // Let's measure the exact text block content width to center the entire group horizontally
  let maxContentWidth = 0;
  let testTitleFontSize = 21 * sizeFactor;
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(testTitleFontSize);
  let testTitleWidth = doc.getTextWidth(singleLineTitle);
  if (testTitleWidth > maxTitleWidth) {
    testTitleFontSize = Math.max(12, (maxTitleWidth / testTitleWidth) * testTitleFontSize);
    doc.setFontSize(testTitleFontSize);
    testTitleWidth = doc.getTextWidth(singleLineTitle);
  }
  maxContentWidth = Math.max(maxContentWidth, testTitleWidth);

  // Body text size measurement
  doc.setFont(pdfFontName, isVintageEditorial ? "bold" : "normal");
  doc.setFontSize(8.5 * sizeFactor);
  addressLines.forEach((line: string) => {
    maxContentWidth = Math.max(maxContentWidth, doc.getTextWidth(line));
  });

  let contactString = `Phone: ${businessInfo.phoneNumber}`;
  if (businessInfo.email) {
    contactString += `   |   Email: ${businessInfo.email}`;
  }
  maxContentWidth = Math.max(maxContentWidth, doc.getTextWidth(contactString));

  if (businessInfo.vatRegNo) {
    maxContentWidth = Math.max(maxContentWidth, doc.getTextWidth(`VAT Reg No: ${businessInfo.vatRegNo}`));
  }

  // Calculate horizontally centered group coordinates
  const totalGroupWidth = hasLogoDrawn ? (logoWidth + 8 + maxContentWidth) : maxContentWidth;
  brandX = 15 + (180 - totalGroupWidth) / 2;
  let infoX = hasLogoDrawn ? brandX + logoWidth + 8 : brandX;

  // Draw Logo
  if (hasLogoImg && companyLogoStr) {
    try {
      doc.addImage(companyLogoStr, 'PNG', brandX, identityY, logoWidth, logoHeight);
    } catch (e) {
      console.error("Error drawing logo in PDF:", e);
    }
  } else if (hasLogoTextSymbol && companyLogoStr) {
    try {
      // Use design theme color for the circular backplate
      doc.setFillColor(billToBg[0], billToBg[1], billToBg[2]);
      doc.circle(brandX + 17, identityY + 17, 17, 'F');
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(18 * sizeFactor);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(companyLogoStr, brandX + 17, identityY + 23, { align: 'center' });
    } catch (e) {
      // ignore
    }
  }

  // Compute height of details text block to perfectly center it horizontally and vertically with the logo
  const textSpacing = 4.5;
  const titleHeight = 7 * sizeFactor;
  const totalTextHeight = titleHeight + 1.5 + (addressLines.length * textSpacing) + textSpacing + (businessInfo.vatRegNo ? textSpacing : 0);

  let textStartOffset = 0;
  if (hasLogoDrawn && logoHeight > totalTextHeight) {
    textStartOffset = (logoHeight - totalTextHeight) / 2;
  }

  let titleY = identityY + textStartOffset + 5.0 * sizeFactor;
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(testTitleFontSize);
  
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(singleLineTitle, infoX, titleY);
  titleY = titleY + titleHeight;

  // Address, phone, email & tax register - Left aligned to the right column
  doc.setFont(pdfFontName, isVintageEditorial ? "bold" : "normal");
  doc.setFontSize(8.5 * sizeFactor);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  let textY = titleY + 1.5;
  addressLines.forEach((line: string) => {
    doc.text(line, infoX, textY);
    textY += textSpacing;
  });

  doc.text(contactString, infoX, textY);
  textY += textSpacing;

  if (businessInfo.vatRegNo) {
    doc.text(`VAT Reg No: ${businessInfo.vatRegNo}`, infoX, textY);
    textY += textSpacing;
  }

  let brandYEnd = Math.max(textY + 4, identityY + logoHeight + 4);
  let currentY = brandYEnd;

  // High-contrast clean thin separator line
  if (isVintageEditorial) {
    // Literary Editorial double line
    doc.setDrawColor(accentLineColor[0], accentLineColor[1], accentLineColor[2]);
    doc.setLineWidth(0.4);
    doc.line(15, currentY, 195, currentY);
    doc.setLineWidth(0.2);
    doc.line(15, currentY + 1.2, 195, currentY + 1.2);
    currentY += 6;
  } else if (isCompactPOS) {
    // Dashed receipt cut guideline
    doc.setDrawColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.setLineWidth(0.35);
    doc.line(15, currentY, 195, currentY);
    doc.setLineDashPattern([], 0); // Reset
    currentY += 6;
  } else {
    doc.setDrawColor(accentLineColor[0], accentLineColor[1], accentLineColor[2]);
    doc.setLineWidth(0.6);
    doc.line(15, currentY, 195, currentY);
    currentY += 6;
  }

  // Bill-To Box Panel (Render Client Address info beautifully depending on theme)
  if (isCompactPOS) {
    // Ticket style client layout (No background box, just clean text boundaries)
    doc.setDrawColor(200, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(15, currentY, 195, currentY);
    
    // Left side: Invoice metadata
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(7.5 * sizeFactor);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`INVOICE #: ${transaction.invoiceNo}`, 15, currentY + 5);

    doc.setFont(pdfFontName, "normal");
    doc.setFontSize(7.5 * sizeFactor);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Date: ${formattedDate} ${formattedTime}`, 15, currentY + 10);
    doc.text(`Payment: ${transaction.paymentMethod.toUpperCase()}`, 15, currentY + 15);

    // Right side: Customer / Shipping Details
    doc.setFont(pdfFontName, "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CUSTOMER PARTICULARS:", 105, currentY + 5);

    const cName = contact ? contact.name : "Walk-in Regular Customer";
    doc.text(cName, 105, currentY + 10);

    doc.setFont(pdfFontName, "normal");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const cPhone = contact ? `Phone: ${contact.phone}` : "Phone: Walk-in Cash";
    doc.text(cPhone, 105, currentY + 15);

    const cAddr = contact ? `Addr: ${contact.address}` : "Addr: Counter Sale";
    const addrLines = doc.splitTextToSize(cAddr, 80);
    doc.text(addrLines, 105, currentY + 20);
    
    currentY += 28;
  } else {
    // Default / Boxed Theme Panel layouts with redesigned side-by-side columns
    const boxHeight = 32;
    doc.setFillColor(billToBg[0], billToBg[1], billToBg[2]);
    if (isVintageEditorial) {
      doc.rect(15, currentY, 180, boxHeight, 'F');
      if (billToBorderColor) {
        doc.setDrawColor(billToBorderColor[0], billToBorderColor[1], billToBorderColor[2]);
        doc.setLineWidth(0.4);
        doc.rect(15, currentY, 180, boxHeight, 'S');
      }
    } else {
      doc.roundedRect(15, currentY, 180, boxHeight, 1.5, 1.5, 'F');
      if (billToBorderColor) {
        doc.setDrawColor(billToBorderColor[0], billToBorderColor[1], billToBorderColor[2]);
        doc.setLineWidth(0.2);
        doc.roundedRect(15, currentY, 180, boxHeight, 1.5, 1.5, 'S');
      }
    }

    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(7.5 * sizeFactor);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("INVOICE METADATA DETAILS", 20, currentY + 5.5);
    doc.text("CUSTOMER & SHIPPING DETAILS", 105, currentY + 5.5);

    // Left Column Content (Invoice metadata)
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(8.5 * sizeFactor);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`INVOICE #: ${transaction.invoiceNo}`, 20, currentY + 11.5);

    doc.setFont(pdfFontName, "normal");
    doc.setFontSize(8 * sizeFactor);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Issue Date: ${formattedDate}`, 20, currentY + 16.5);
    doc.text(`Issue Time: ${formattedTime || "N/A"}`, 20, currentY + 21.0);
    doc.text(`Sales Agent: Showroom Account Executive`, 20, currentY + 25.5);
    doc.text(`Payment Mode: ${transaction.paymentMethod.toUpperCase()}`, 20, currentY + 30.0);

    // Right Column Content (Combined Customer Biography & Address Details)
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(9 * sizeFactor);
    doc.setTextColor(15, 23, 42); // slate-900
    const cName = contact ? contact.name : "Walk-in Regular Customer";
    doc.text(cName, 105, currentY + 11.5);

    doc.setFont(pdfFontName, "normal");
    doc.setFontSize(8 * sizeFactor);
    doc.setTextColor(71, 85, 105); // slate-600
    const cPhone = contact ? `Phone: ${contact.phone}` : "Phone: Over-the-counter Transaction";
    doc.text(cPhone, 105, currentY + 16.5);

    const cAddr = contact ? `Address: ${contact.address}` : "Address: Dhaka, Bangladesh";
    const addrLines = doc.splitTextToSize(cAddr, 80);
    doc.text(addrLines, 105, currentY + 21.0);

    currentY += (boxHeight + 6);
  }

  // Main Itemized Table mapping
  const tableHeaders = [['SL', 'Item Model / Specification / SKU', 'Qty', 'Unit Rate', 'Total Amount']];
  const tableBody = transaction.items.map((item, index) => [
    (index + 1).toString(),
    item.name,
    item.quantity.toString(),
    `${devCurrencySymbol} ${item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${devCurrencySymbol} ${item.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  // Generate beautiful AutoTable (customized per theme layout)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    head: tableHeaders,
    body: tableBody,
    theme: template === "modern_minimal" || isVintageEditorial ? "grid" : "striped",
    styles: {
      fontSize: 8.5 * sizeFactor,
      font: pdfFontName,
      cellPadding: isCompactPOS ? 2.5 : 3.5,
      textColor: [51, 65, 85], // slate-700
      lineColor: [241, 245, 249],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: tableHeadBg,
      textColor: tableHeadTextColor,
      fontSize: 9 * sizeFactor,
      fontStyle: 'bold',
      cellPadding: 4,
      lineWidth: isVintageEditorial ? 0.3 : 0,
      lineColor: isVintageEditorial ? primaryColor : [255, 255, 255]
    },
    alternateRowStyles: {
      fillColor: template === "cosmic_dark" ? [250, 250, 250] : [248, 250, 252] // subtle gray rows
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // BOTTOM FINANCIAL & SIGNATURES SECTION
  // Left Column: Total in Words block & Showroom Terms
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text("TOTAL BILL IN WORDS:", 15, finalY + 5.5);

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(8.5 * sizeFactor);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  const tVerbal = numberToWords(transaction.total);
  const wordLines = doc.splitTextToSize(tVerbal, 110);
  doc.text(wordLines, 15, finalY + 11.5);

  // Showroom Terms
  let termsTitleY = finalY + 22;
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("OFFICIAL WARRANTY, TERMS & CONDITIONS", 15, termsTitleY);

  let termsY = termsTitleY + 4.5;
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(6.5 * sizeFactor);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

  let terms: string[] = [];
  if (businessInfo.termsConditions) {
    terms = businessInfo.termsConditions.split("\n").filter(line => line.trim().length > 0);
  } else {
    terms = [
      "1. Original cash receipt/invoice is strictly required for any warranty or replacement registration claims.",
      "2. Warranty is void if products display physical damage, burned ICs, power surge trails, or fluid exposure.",
      "3. Discrepancies if any must be brought to notice of the showroom management within 3 days of product issue."
    ];
  }

  terms.forEach(term => {
    const splitLines = doc.splitTextToSize(term, 110);
    splitLines.forEach((line: string) => {
      doc.text(line, 15, termsY);
      termsY += 3.5;
    });
  });

  // Right Column: Financial Card (Subtotal, VAT, Discount, Grand Total, Cash Paid, Change/Due)
  let rightX = 135;
  let summaryY = finalY;

  // Premium clean flat totals box
  doc.setFillColor(255, 255, 255);
  doc.rect(rightX - 2, summaryY - 2, 62, 38, 'F');

  // Print summary elements
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(80, 80, 85); // Slate/charcoal gray text
  doc.text("Gross Subtotal:", rightX, summaryY + 4);
  doc.text(`${devCurrencySymbol} ${transaction.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 4, { align: "right" });

  doc.text("VAT Surcharges:", rightX, summaryY + 9);
  doc.text(`+${devCurrencySymbol} ${transaction.tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 9, { align: "right" });

  // Grayscale premium discount label, no loud red
  doc.setTextColor(80, 80, 85);
  doc.text("Special Discount:", rightX, summaryY + 14);
  doc.text(`-${devCurrencySymbol} ${transaction.discount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 14, { align: "right" });

  // Minimal separator line
  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.35);
  doc.line(rightX - 2, summaryY + 17.5, rightX + 60, summaryY + 17.5);

  // Elegant neutral off-white/gray tint for Grand Total details highlighting
  let highlightBg = [245, 245, 247];
  doc.setFillColor(highlightBg[0], highlightBg[1], highlightBg[2]);
  doc.rect(rightX - 1.6, summaryY + 17.8, 61.2, 17.7, 'F');

  const excess = transaction.paidAmount - transaction.total;
  const hasDue = transaction.dueBalance > 0;

  // Grand Total details
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(9 * sizeFactor);
  doc.setTextColor(15, 23, 42); // bold black/charcoal
  doc.text("GRAND BILL TOTAL:", rightX, summaryY + 22.5);
  doc.text(`${devCurrencySymbol} ${transaction.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 22.5, { align: "right" });

  // Cash Received
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(50, 50, 55);
  doc.text("Total Cash Received:", rightX, summaryY + 27);
  doc.text(`${devCurrencySymbol} ${transaction.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 27, { align: "right" });

  // Change or Due Balance details - PREMIUM CONDITIONAL BADGE STYLING
  doc.setFont(pdfFontName, "bold");
  if (excess > 0 || !hasDue) {
    // Prominent beautifully styled FULL PAID stamp/badge with light green background alignment
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(rightX - 1.5, summaryY + 30.5, 61, 7.5, 1, 1, "F");
    
    doc.setFontSize(8.5 * sizeFactor);
    doc.setTextColor(21, 115, 52);
    // Centered FULL PAID text with stars for a distinct stamp style
    doc.text("★ FULL PAID ★", rightX + 29, summaryY + 35.8, { align: "center" });
  } else {
    // Soft red background highlighter block with bold dark red text for OUTSTANDING DUE
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(rightX - 1.5, summaryY + 30.5, 61, 7.5, 1, 1, "F");
    
    doc.setFontSize(7.5 * sizeFactor);
    doc.setTextColor(185, 28, 28); // bold dark red text
    doc.text("Dues Outstanding:", rightX + 2, summaryY + 35.4);
    doc.text(`${devCurrencySymbol} ${transaction.dueBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 35.4, { align: "right" });
  }

  // SIGNATURES ROW
  let sigY = Math.max(summaryY + 54, termsY + 16);
  if (sigY > 260) {
    doc.addPage();
    sigY = 32;
  }

  const sigLineY = sigY + 11;
  const isCustSigOn = businessInfo.showCustomerSignature !== false;
  const isAuthSigOn = businessInfo.showAuthorizedSignature !== false;

  if (isCustSigOn) {
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.3);
    doc.line(15, sigLineY, 70, sigLineY);

    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(7 * sizeFactor);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("CUSTOMER REGISTERED SIGN-OFF", 42.5, sigLineY + 4.5, { align: "center" });

    if (transaction.customerSignature) {
      try {
        doc.addImage(transaction.customerSignature, 'PNG', 18, sigLineY - 10.5, 42, 9);
      } catch (e) {
        // ignore
      }
    }
  }

  if (isAuthSigOn) {
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]); // Match design theme
    doc.setLineWidth(template === "bold_emerald" || template === "premium_navy" ? 0.6 : 0.4);
    doc.line(140, sigLineY, 195, sigLineY);

    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(7 * sizeFactor);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("AUTHORIZED SHOWROOM BRAND SIGN", 167.5, sigLineY + 4.5, { align: "center" });
  }

  // ----------------- PARTNER BRAND LOGOS SECTION -----------------
  const showPartners = businessInfo.showPartnerLogos !== false;
  const partnerLogos = businessInfo.partnerLogos || [];
  const presetBrands = businessInfo.presetBrands || [];

  if (showPartners && (partnerLogos.length > 0 || presetBrands.length > 0)) {
    let partnerY = 259; // Y position above system footer
    
    // Draw subtle brand divider text
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(6.5 * sizeFactor);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text("A U T H O R I Z E D   O F F I C I A L   B R A N D   P A R T N E R S", 105, partnerY, { align: "center" });
    
    // Thin horizontal divider line under the heading
    doc.setDrawColor(226, 232, 240); // slate-200 line
    doc.setLineWidth(0.3);
    doc.line(15, partnerY + 1.5, 195, partnerY + 1.5);
    
    // Calculate equal spacing for items
    const allPresets = presetBrands;
    const allCustoms = partnerLogos;
    const totalItemsCount = allPresets.length + allCustoms.length;
    
    if (totalItemsCount > 0) {
      let drawY = partnerY + 3.2;
      const pageMarginLeft = 15;
      const pageMarginRight = 195;
      const printableWidth = pageMarginRight - pageMarginLeft;
      const colWidth = printableWidth / totalItemsCount;
      
      // Draw custom uploads and preset badge marks
      let index = 0;
      
      // 1. Draw custom base64 logos (each within an ultra-clean container with a subtle, thin outline and no shadow)
      allCustoms.forEach((logoB64) => {
        const itemCenterX = pageMarginLeft + (index * colWidth) + (colWidth / 2);
        const boxW = Math.max(16, Math.min(26, colWidth - 2.5));
        const boxH = 8.5;
        const leftX = itemCenterX - (boxW / 2);
        
        // Top container card with clean subtle border (No heavy black shadows or thick blocks)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225); // Slate-300 thin border outline
        doc.setLineWidth(0.3);
        doc.roundedRect(leftX, drawY, boxW, boxH, 1, 1, 'FD');
        
        try {
          // Keep original aspect ratio and prevent distortion
          const props = doc.getImageProperties(logoB64);
          const srcWidth = props.width || 1;
          const srcHeight = props.height || 1;
          const srcRatio = srcWidth / srcHeight;

          // Inside the box padding limits
          const limitW = boxW - 2.5;
          const limitH = boxH - 2;
          const containerRatio = limitW / limitH;

          let imgW = limitW;
          let imgH = limitH;

          if (srcRatio > containerRatio) {
            // image is wider relative to limits: bound by width
            imgW = limitW;
            imgH = limitW / srcRatio;
          } else {
            // image is taller relative to limits: bound by height
            imgH = limitH;
            imgW = limitH * srcRatio;
          }

          // Compute centered alignment within the container
          const imgX = itemCenterX - (imgW / 2);
          const imgY = drawY + (boxH - imgH) / 2;
          doc.addImage(logoB64, 'PNG', imgX, imgY, imgW, imgH);
        } catch (e) {
          console.error("Error embedding partner custom logo in PDF:", e);
          // Fallback text matching the premium style
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(6 * sizeFactor);
          doc.setTextColor(0, 0, 0); // Bold black name
          doc.text("BRAND " + (index + 1), itemCenterX, drawY + (boxH / 2) + 1.25, { align: "center" });
        }
        index++;
      });
      
      // 2. Draw preset text badges (each within an ultra-clean container with a subtle, thin outline and no shadow)
      allPresets.forEach((name) => {
        const itemCenterX = pageMarginLeft + (index * colWidth) + (colWidth / 2);
        const boxW = Math.max(16, Math.min(26, colWidth - 2.5));
        const boxH = 8.5;
        const leftX = itemCenterX - (boxW / 2);
        
        // Top container card with clean subtle border (No heavy black shadows or thick blocks)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225); // Slate-300 thin border outline
        doc.setLineWidth(0.3);
        doc.roundedRect(leftX, drawY, boxW, boxH, 1, 1, 'FD');
        
        // Draw Brand Name Centered inside the box (Name is also bold black)
        doc.setFont("Helvetica", "bold");
        let badgeFontSize = 6 * sizeFactor;
        
        // Dynamically scale down font if text is wide for the block
        const textWidth = doc.getTextWidth(name.toUpperCase());
        if (textWidth > boxW - 2) {
          badgeFontSize = Math.max(4.5, ((boxW - 2) / textWidth) * badgeFontSize);
        }
        
        doc.setFontSize(badgeFontSize);
        doc.setTextColor(0, 0, 0); // Name is black
        
        // Compute precise vertical center position (boxY + half height + offset)
        const textY = drawY + (boxH / 2) + 1.25;
        doc.text(name.toUpperCase(), itemCenterX, textY, { align: "center" });
        index++;
      });
    }
  }

  // Centered system footer message
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Electronic audit record. Generated instantly by ${businessInfo?.name || "Barakah E-Mart"}. All rights reserved.`, 105, 288, { align: "center" });

  doc.save(`${transaction.invoiceNo}_Showroom_Invoice.pdf`);
}

export async function generateDeliveryChallanPDF(transaction: Transaction, contact: Contact | undefined, businessInfo: BusinessInfo) {
  const doc = new jsPDF();
  const devCurrencySymbol = businessInfo.currencySymbol === "৳" ? "TK" : businessInfo.currencySymbol;
  
  // Font Size Scaling Factor from localStorage
  const sizeSetting = localStorage.getItem("font_size_scale") || "Regular";
  let sizeFactor = 1.0;
  if (sizeSetting === "Medium") sizeFactor = 1.15;
  if (sizeSetting === "Large") sizeFactor = 1.3;

  let pdfFontName = "Helvetica";
  const userFont = businessInfo.selectedFont || "Inter";

  // Dynamic Google Font Injection
  if (FONT_URLS[userFont]) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(FONT_URLS[userFont], { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const base64Font = arrayBufferToBase64(arrayBuffer);
        doc.addFileToVFS(`${userFont}.ttf`, base64Font);
        doc.addFont(`${userFont}.ttf`, userFont, "normal");
        pdfFontName = userFont;
      }
    } catch (e) {
      console.warn(`Could not load Google Font ${userFont} dynamically, falling back to Helvetica. Error:`, e);
    }
  }

  let formattedDate = "N/A";
  let formattedTime = "";
  try {
    const tDate = new Date(transaction.date);
    if (!isNaN(tDate.getTime())) {
      formattedDate = format(tDate, 'dd/MM/yyyy');
      formattedTime = format(tDate, 'hh:mm a');
    }
  } catch (e) {
    // fallback
  }

  const showLogoSetting = businessInfo.showLogoInInvoice !== false;
  const companyLogoStr = businessInfo.companyLogo;
  const hasLogoImg = showLogoSetting && companyLogoStr && (companyLogoStr.startsWith("data:") || companyLogoStr.startsWith("http"));
  const hasLogoTextSymbol = showLogoSetting && companyLogoStr && !hasLogoImg && companyLogoStr.trim().length <= 3;
  const hasLogoLongText = showLogoSetting && companyLogoStr && !hasLogoImg && companyLogoStr.trim().length > 3;

  // Render Left Column: Showroom Identity Info & Prominent Branding Logo
  let brandX = 15;
  let identityY = 18;
  let metaX = 125;
  let metaY = 18;
  let logoWidth = 28;
  let logoHeight = 28;
  let hasLogoDrawn = false;

  if (hasLogoImg && companyLogoStr) {
    try {
      doc.addImage(companyLogoStr, 'PNG', brandX, identityY, logoWidth, logoHeight);
      hasLogoDrawn = true;
    } catch (e) {
      console.error("Error drawing logo in PDF:", e);
    }
  } else if (hasLogoTextSymbol && companyLogoStr) {
    try {
      doc.setFillColor(241, 245, 249); // slate-100 placeholder backplate
      doc.circle(brandX + 14, identityY + 14, 14, 'F');
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(14 * sizeFactor);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(companyLogoStr, brandX + 14, identityY + 18.5, { align: 'center' });
      hasLogoDrawn = true;
    } catch (e) {
      // ignore
    }
  }

  // Draw Showroom Title Name
  let infoX = hasLogoDrawn ? brandX + logoWidth + 7 : brandX;
  const maxTitleWidth = metaX - infoX - 4; // safe width before metaX
  const addressLines = doc.splitTextToSize(businessInfo.address || "Showroom Address, Dhaka", maxTitleWidth);

  // Compute layout heights for dynamic vertical centering
  const textSpacing = 4.0;
  const titleHeight = 6.5 * sizeFactor;
  const totalTextHeight = titleHeight + 1.5 + (addressLines.length * textSpacing) + textSpacing + (businessInfo.vatRegNo ? textSpacing : 0);

  let textStartOffset = 0;
  if (hasLogoDrawn && logoHeight > totalTextHeight) {
    textStartOffset = (logoHeight - totalTextHeight) / 2;
  }

  let titleY = identityY + textStartOffset + 5.5 * sizeFactor;
  doc.setFont(pdfFontName, "bold");
  
  const normLogo = hasLogoLongText ? (companyLogoStr || "").trim().toUpperCase() : "";
  const normBiz = (businessInfo?.name || "BARAKAH E-MART").trim().toUpperCase();
  const isSimilar = normLogo === normBiz || (normLogo && normBiz && (normLogo.startsWith(normBiz.substring(0, 6)) || normBiz.startsWith(normLogo.substring(0, 1))));

  let singleLineTitle = normBiz;
  if (hasLogoLongText) {
    if (isSimilar) {
      // If titles are similar, prioritize the user-specified custom logo name directly to avoid duplication.
      singleLineTitle = normLogo;
    } else {
      // If titles are completely different, place them neatly in line in a single coherent flow
      singleLineTitle = `${normLogo} | ${normBiz}`;
    }
  }
  let titleFontSize = 18 * sizeFactor;
  
  doc.setFontSize(titleFontSize);
  const measuredTitleWidth = doc.getTextWidth(singleLineTitle);
  if (measuredTitleWidth > maxTitleWidth) {
    titleFontSize = Math.max(11, (maxTitleWidth / measuredTitleWidth) * titleFontSize);
    doc.setFontSize(titleFontSize);
  }
  
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(singleLineTitle, infoX, titleY);
  titleY = titleY + titleHeight;

  // Address, phone, email & tax register
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(71, 85, 105); // slate-600

  let textY = titleY + 1.5;
  addressLines.forEach((line: string) => {
    doc.text(line, infoX, textY);
    textY += textSpacing;
  });

  doc.text(`Phone: ${businessInfo.phoneNumber}`, infoX, textY);
  textY += textSpacing;
  if (businessInfo.email) {
    doc.text(`Email: ${businessInfo.email}`, infoX, textY);
    textY += textSpacing;
  }
  if (businessInfo.vatRegNo) {
    doc.text(`VAT Reg No: ${businessInfo.vatRegNo}`, infoX, textY);
    textY += textSpacing;
  }

  let brandYEnd = Math.max(textY, identityY + logoHeight + 4);

  // Render Right Column: Challan Metadata
  // Perfectly align the first line of metadata on the exact same horizontal baseline as the store title.
  let rightY = identityY + 5.5;

  // Challan Number (Unique reference)
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(12 * sizeFactor);
  doc.setTextColor(15, 23, 42);
  doc.text("DELIVERY CHALLAN", metaX, rightY);
  rightY += 6.5;

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(9.5 * sizeFactor);
  doc.text(`CHALLAN #: CH-${transaction.invoiceNo.replace(/[^0-9a-zA-Z]/g, '') || transaction.id.substring(0, 8)}`, metaX, rightY);
  rightY += 5.5;

  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Ref Invoice No: ${transaction.invoiceNo}`, metaX, rightY);
  rightY += 4.5;
  doc.text(`Delivery Date: ${formattedDate}`, metaX, rightY);
  rightY += 4.5;
  if (formattedTime) {
    doc.text(`Delivery Time: ${formattedTime}`, metaX, rightY);
    rightY += 4.5;
  }

  let metaYEnd = rightY + 6;
  let currentY = Math.max(brandYEnd, metaYEnd);

  // High-contrast clean thin separator line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(15, currentY, 195, currentY);
  currentY += 6;

  // Beneficiary Customer Segment
  doc.setFillColor(250, 250, 252); // slate-50/off-white (monochromatic)
  doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'F');

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7.5 * sizeFactor);
  doc.setTextColor(115, 115, 120); // gray-500
  doc.text("DELIVERY TO / CUSTOMER IDENTITY DETAILS", 20, currentY + 5.5);
  doc.text("CONTACT DETAILS & DELIVERY ADDRESS", 105, currentY + 5.5);

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(9 * sizeFactor);
  doc.setTextColor(15, 23, 42); // slate-900
  const cName = contact ? contact.name : "Walk-in Regular Customer";
  doc.text(cName, 20, currentY + 11.5);

  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(71, 85, 105); // slate-600
  const cPhone = contact ? `Phone: ${contact.phone}` : "Phone: Over-the-counter Transaction";
  const cAddr = contact ? `Address: ${contact.address}` : "Address: Dhaka, Bangladesh";
  
  doc.text(cPhone, 105, currentY + 11.5); // Level with Customer Name
  doc.text(cAddr, 105, currentY + 15); // Level under phone number

  currentY += 24;

  // Main Delivered Items Table
  const tableHeaders = [['SL', 'Purchased Item Model / Specification / SKU', 'Ordered Qty', 'Unit of Delivery', 'Dispatch Status']];
  const tableBody = transaction.items.map((item, index) => [
    (index + 1).toString(),
    item.name,
    item.quantity.toString(),
    "Piece(s)",
    "Delivered / Handed Over"
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    head: tableHeaders,
    body: tableBody,
    theme: 'striped',
    styles: {
      fontSize: 8.5 * sizeFactor,
      font: pdfFontName,
      cellPadding: 4,
      textColor: [51, 65, 85], // slate-700
      lineColor: [241, 245, 249],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [15, 23, 42], // Deep charcoal block
      textColor: [255, 255, 255],
      fontSize: 9 * sizeFactor,
      fontStyle: 'bold',
      cellPadding: 4.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50 rows
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // DUE DECLARATION CARD ZONE
  let dueCardY = finalY;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42); // bold black border
  doc.setLineWidth(0.45);
  doc.roundedRect(15, dueCardY, 180, 22, 1.5, 1.5, 'FD');

  const amountDueVal = transaction.dueBalance || 0;
  const isDuesOutstanding = amountDueVal > 0;

  if (isDuesOutstanding) {
    // Red indicator bar on the left of due panel
    doc.setFillColor(239, 68, 68); // Red
    doc.roundedRect(15.2, dueCardY + 0.2, 3, 21.6, 0.5, 0.5, 'F');
    
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(8.5 * sizeFactor);
    doc.setTextColor(153, 27, 27); // Deep red text
    doc.text("OUTSTANDING ACCOUNT DUE FOR PURCHASED ITEMS", 22, dueCardY + 8);
    
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(11 * sizeFactor);
    doc.setTextColor(153, 27, 27);
    doc.text(`TOTAL AMOUNT DUE:  ${devCurrencySymbol} ${amountDueVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 22, dueCardY + 15);
  } else {
    // Green indicator bar on the left of due panel
    doc.setFillColor(16, 185, 129); // Emerald-500
    doc.roundedRect(15.2, dueCardY + 0.2, 3, 21.6, 0.5, 0.5, 'F');
    
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(8.5 * sizeFactor);
    doc.setTextColor(21, 128, 61); // Deep green text
    doc.text("OUTSTANDING ACCOUNT DUE FOR PURCHASED ITEMS (FULLY SETTLED)", 22, dueCardY + 8);
    
    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(11 * sizeFactor);
    doc.setTextColor(21, 128, 61);
    doc.text(`TOTAL AMOUNT DUE:  ${devCurrencySymbol} 0.00  (NO OUTSTANDING DEBTS)`, 22, dueCardY + 15);
  }

  // Delivery Notes
  let notesY = dueCardY + 30;
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(15, 23, 42);
  doc.text("DELIVERY RULES / TERMS OF ACKNOWLEDGEMENT", 15, notesY);

  let noteLinesY = notesY + 4.5;
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(100, 116, 139); // slate-500

  const deliveryNotes = [
    "1. Delivery Challan acts as official proof of dispatch. Please verify count during delivery.",
    "2. Any physical transit damage or product mismatch must be reported immediately to the dispatcher.",
    "3. Customer's signature constitutes confirmation of products received in completely fresh and intact condition."
  ];

  deliveryNotes.forEach(note => {
    doc.text(note, 15, noteLinesY);
    noteLinesY += 4;
  });

  // SIGNATURES ROW
  let sigY = Math.max(dueCardY + 54, noteLinesY + 10);
  if (sigY > 265) {
    doc.addPage();
    sigY = 32;
  }

  const sigLineY = sigY + 11;

  // Left - Customer Signature (Received Sign)
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.3);
  doc.line(15, sigLineY, 70, sigLineY);

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(71, 85, 105);
  doc.text("RECEIVER'S SIGNATURE & DATE (CUSTOMER)", 42.5, sigLineY + 4.5, { align: "center" });

  if (transaction.customerSignature) {
    try {
      doc.addImage(transaction.customerSignature, 'PNG', 18, sigLineY - 10.5, 42, 9);
    } catch (e) {
      // ignore
    }
  }

  // Center - Delivered/Dispatched By
  doc.setDrawColor(142, 142, 142);
  doc.setLineWidth(0.3);
  doc.line(78, sigLineY, 132, sigLineY);

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(100, 116, 139);
  doc.text("DISPATCHED BY (STORE DESPATCH)", 105, sigLineY + 4.5, { align: "center" });

  // Right - Authorized Store brand Sign
  doc.setDrawColor(15, 23, 42); // Bold brand line
  doc.setLineWidth(0.4);
  doc.line(140, sigLineY, 195, sigLineY);

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(15, 23, 42);
  doc.text("AUTHORIZED SIGNATORY / INCHARGE", 167.5, sigLineY + 4.5, { align: "center" });

  // Footer message
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(148, 163, 184);
  doc.text(`Official Delivery Challan file. Printed by ${businessInfo?.name || "Barakah E-Mart"}.`, 105, 288, { align: "center" });

  doc.save(`CHALLAN_${transaction.invoiceNo}_Showroom.pdf`);
}

