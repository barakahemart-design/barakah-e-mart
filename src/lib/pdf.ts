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
  const hasLogoTextSymbol = showLogoSetting && companyLogoStr && !hasLogoImg;

  // Render Left Column: Showroom Identity Info & Prominent Branding Logo
  let brandX = 15;
  let identityY = 18;
  let metaX = 125;
  let metaY = 18;
  let logoWidth = 24;
  let logoHeight = 24;
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
      doc.circle(brandX + 11, identityY + 11, 11, 'F');
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(14 * sizeFactor);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(companyLogoStr, brandX + 11, identityY + 14.5, { align: 'center' });
      hasLogoDrawn = true;
    } catch (e) {
      // ignore
    }
  }

  // Draw Showroom Title Name (Prominent & Significantly Larger - Single Line)
  let infoX = hasLogoDrawn ? brandX + logoWidth + 6 : brandX;
  doc.setFont(pdfFontName, "bold");
  
  const singleLineTitle = (businessInfo?.name || "BARAKAH ELECTRONICS").toUpperCase();
  const maxTitleWidth = metaX - infoX - 4; // safe width before metaX
  let titleFontSize = 20 * sizeFactor;
  
  doc.setFontSize(titleFontSize);
  const measuredTitleWidth = doc.getTextWidth(singleLineTitle);
  if (measuredTitleWidth > maxTitleWidth) {
    titleFontSize = Math.max(11, (maxTitleWidth / measuredTitleWidth) * titleFontSize);
    doc.setFontSize(titleFontSize);
  }
  
  doc.setTextColor(15, 23, 42); // slate-900
  let titleY = identityY + 5.5;
  doc.text(singleLineTitle, infoX, titleY);
  titleY = titleY + 6.5 * sizeFactor;

  // Address, phone, email & tax register
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(71, 85, 105); // slate-600

  let textY = Math.max(titleY + 1.5, identityY + 11);
  const addressLines = doc.splitTextToSize(businessInfo.address || "Showroom Address, Dhaka", maxTitleWidth);
  addressLines.forEach((line: string) => {
    doc.text(line, infoX, textY);
    textY += 4;
  });

  doc.text(`Phone: ${businessInfo.phoneNumber}`, infoX, textY);
  textY += 4;
  if (businessInfo.email) {
    doc.text(`Email: ${businessInfo.email}`, infoX, textY);
    textY += 4;
  }
  if (businessInfo.vatRegNo) {
    doc.text(`VAT Reg No: ${businessInfo.vatRegNo}`, infoX, textY);
    textY += 4;
  }

  let brandYEnd = Math.max(textY, identityY + logoHeight + 4);

  // Render Right Column: Invoice Metadata (Invoice No, Date, Salesperson, Payment Status)
  let rightY = metaY + 5.5; // Aligns perfectly on the horizontal axis with Showroom Title Y position

  // Invoice Number (Significantly Larger & Bold)
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(11 * sizeFactor);
  doc.setTextColor(15, 23, 42);
  doc.text(`INVOICE #: ${transaction.invoiceNo}`, metaX, rightY);
  rightY += 6;

  // Date and Time
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Issue Date: ${formattedDate}`, metaX, rightY);
  rightY += 4.5;
  if (formattedTime) {
    doc.text(`Issue Time: ${formattedTime}`, metaX, rightY);
    rightY += 4.5;
  }

  // Sales Agent (Salesman Name)
  doc.text("Sales Agent: Showroom Account Executive", metaX, rightY);
  rightY += 4.5;

  // Payment Method
  doc.text(`Payment Mode: ${transaction.paymentMethod.toUpperCase()}`, metaX, rightY);
  rightY += 5.5;

  // Payment Status Pill (Subtle High-Contrast Background Card)
  const statusConfig = transaction.status === "paid"
    ? { bg: [220, 252, 231], text: [21, 128, 61], label: "FULLY PAID" }
    : transaction.status === "partial"
    ? { bg: [254, 243, 199], text: [180, 83, 9], label: "PARTIALLY PAID" }
    : { bg: [254, 226, 226], text: [220, 38, 38], label: "OUTSTANDING DUE" };

  doc.setFillColor(statusConfig.bg[0], statusConfig.bg[1], statusConfig.bg[2]);
  doc.roundedRect(metaX, rightY, 38, 6.5, 1, 1, 'F');

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7.5 * sizeFactor);
  doc.setTextColor(statusConfig.text[0], statusConfig.text[1], statusConfig.text[2]);
  doc.text(statusConfig.label, metaX + 19, rightY + 4.5, { align: "center" });

  let metaYEnd = rightY + 11;
  let currentY = Math.max(brandYEnd, metaYEnd);

  // High-contrast clean thin separator line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(15, currentY, 195, currentY);
  currentY += 6;

  // Bil-To Box Panel
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'S');

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7.5 * sizeFactor);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("CUSTOMER IDENTITY & SHIPPING ADDRESS", 20, currentY + 5.5);

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
  doc.text(cPhone, 105, currentY + 8.5);
  doc.text(cAddr, 105, currentY + 13.5);

  currentY += 24;

  // Main Itemized Table mapping
  const tableHeaders = [['SL', 'Item Model / Specification / SKU', 'Qty', 'Unit Rate', 'Total Amount']];
  const tableBody = transaction.items.map((item, index) => [
    (index + 1).toString(),
    item.name,
    item.quantity.toString(),
    `${devCurrencySymbol} ${item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${devCurrencySymbol} ${item.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  // Generate beautiful AutoTable (subtle background block headers, clean borders)
  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    head: tableHeaders,
    body: tableBody,
    theme: 'striped',
    styles: {
      fontSize: 8.5 * sizeFactor,
      font: pdfFontName,
      cellPadding: 3.5,
      textColor: [51, 65, 85], // slate-700
      lineColor: [241, 245, 249],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [15, 23, 42], // Deep charcoal block
      textColor: [255, 255, 255],
      fontSize: 9 * sizeFactor,
      fontStyle: 'bold',
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50 rows
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // BOTTOM FINANCIAL & SIGNATURES SECTION
  // Left Column: Total in Words block & Showroom Terms
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(15, finalY, 110, 16, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, finalY, 110, 16, 1.5, 1.5, 'S');

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7 * sizeFactor);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("TOTAL BILL IN WORDS (PRONOUNCEMENT):", 20, finalY + 5);

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(15, 23, 42); // slate-900
  const tVerbal = numberToWords(transaction.total);
  const wordLines = doc.splitTextToSize(tVerbal, 100);
  doc.text(wordLines, 20, finalY + 10);

  // Showroom Terms
  let termsTitleY = finalY + 20;
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(15, 23, 42);
  doc.text("OFFICIAL WARRANTY & TERMS OF LEASE", 15, termsTitleY);

  let termsY = termsTitleY + 4.5;
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(6.5 * sizeFactor);
  doc.setTextColor(100, 116, 139); // slate-500

  let terms: string[] = [];
  if (businessInfo.termsConditions) {
    terms = businessInfo.termsConditions.split("\n").filter(line => line.trim().length > 0);
  } else {
    terms = [
      "1. physical showroom copy receipt required for any warranty or replacement claims.",
      "2. Warranty void if products display physical tracks, power surges, or burned chips.",
      "3. Discrepancies if any must be brought to notices of authorized showroom manager within 3 days."
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

  // Card background
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(rightX - 2, summaryY - 2, 62, 38, 2, 2, 'F');
  doc.setDrawColor(15, 23, 42); // slate-900 border
  doc.setLineWidth(0.4);
  doc.roundedRect(rightX - 2, summaryY - 2, 62, 38, 2, 2, 'S');

  // Print summary elements
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("Gross Subtotal:", rightX, summaryY + 4);
  doc.text(`${devCurrencySymbol} ${transaction.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 4, { align: "right" });

  doc.text("VAT Surcharges:", rightX, summaryY + 9);
  doc.text(`+${devCurrencySymbol} ${transaction.tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 9, { align: "right" });

  doc.setTextColor(239, 68, 68);
  doc.text("Special Discount:", rightX, summaryY + 14);
  doc.text(`-${devCurrencySymbol} ${transaction.discount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 14, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(rightX, summaryY + 17.5, 190, summaryY + 17.5);

  // Grand Total
  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(9.5 * sizeFactor);
  doc.setTextColor(15, 23, 42);
  doc.text("GRAND BILL TOTAL:", rightX, summaryY + 22.5);
  doc.text(`${devCurrencySymbol} ${transaction.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, summaryY + 22.5, { align: "right" });

  // ----------------- HIGHLIGHTER DECORATIONS -----------------
  const excess = transaction.paidAmount - transaction.total;
  const hasDue = transaction.dueBalance > 0;

  if (hasDue) {
    // Ultra clean flat single-color soft pink background with absolutely no multi-color border or accent block lines
    doc.setFillColor(254, 242, 242); // soft red-50 background only
    doc.roundedRect(rightX - 1.5, summaryY + 29.5, 61, 5.8, 1, 1, 'F');
  } else {
    // Ultra clean flat single-color soft emerald background with absolutely no multi-color border or accent block lines
    doc.setFillColor(240, 253, 244); // soft green-50 background only
    doc.roundedRect(rightX - 1.5, summaryY + 24.5, 61, 5.8, 1, 1, 'F');
  }

  // Cash Paid
  if (!hasDue) {
    doc.setFont(pdfFontName, "bold");
    doc.setTextColor(15, 23, 42); // deep readable high-contrast dark text
  } else {
    doc.setFont(pdfFontName, "normal");
    doc.setTextColor(71, 85, 105); // standard slate-600
  }
  doc.setFontSize(8 * sizeFactor);
  doc.text("Total Cash Received:", !hasDue ? rightX + 2.5 : rightX, summaryY + 28);
  doc.text(`${devCurrencySymbol} ${transaction.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 189.5, summaryY + 28, { align: "right" });

  // Change or Due Balance
  if (excess > 0) {
    doc.setFont(pdfFontName, "normal");
    doc.setTextColor(14, 116, 144); // cyn-750 representing change
    doc.text("Change Returned:", rightX, summaryY + 33);
    doc.text(`${devCurrencySymbol} ${excess.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 189.5, summaryY + 33, { align: "right" });
  } else {
    if (hasDue) {
      doc.setFont(pdfFontName, "bold");
      doc.setTextColor(153, 27, 27); // high contrast deep dark red-900 text for maximum legibility
    } else {
      doc.setFont(pdfFontName, "normal");
      doc.setTextColor(71, 85, 105);
    }
    doc.text("Dues Outstanding:", hasDue ? rightX + 2.5 : rightX, summaryY + 33);
    doc.text(`${devCurrencySymbol} ${transaction.dueBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 189.5, summaryY + 33, { align: "right" });
  }

  // SIGNATURES ROW
  let sigY = Math.max(summaryY + 44, termsY + 8);
  if (sigY > 265) {
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
    doc.setTextColor(71, 85, 105); // slate-600
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
    doc.setDrawColor(15, 23, 42); // Bold dark brand line for authority
    doc.setLineWidth(0.4);
    doc.line(140, sigLineY, 195, sigLineY);

    doc.setFont(pdfFontName, "bold");
    doc.setFontSize(7 * sizeFactor);
    doc.setTextColor(15, 23, 42);
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
      
      // 1. Draw custom base64 logos (each within a custom black outlined container with a nice black shadow)
      allCustoms.forEach((logoB64) => {
        const itemCenterX = pageMarginLeft + (index * colWidth) + (colWidth / 2);
        const boxW = Math.max(16, Math.min(26, colWidth - 2.5));
        const boxH = 8.5;
        const leftX = itemCenterX - (boxW / 2);
        
        // Solid black offset shadow behind the badge
        doc.setFillColor(15, 23, 42); // Black shadow
        doc.roundedRect(leftX + 0.8, drawY + 0.8, boxW, boxH, 1, 1, 'F');

        // Top white container card with thick black outline borders
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(15, 23, 42); // Black border outline
        doc.setLineWidth(0.45);
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
      
      // 2. Draw preset text badges
      allPresets.forEach((name) => {
        const itemCenterX = pageMarginLeft + (index * colWidth) + (colWidth / 2);
        const boxW = Math.max(16, Math.min(26, colWidth - 2.5));
        const boxH = 8.5;
        const leftX = itemCenterX - (boxW / 2);
        
        // Solid black offset shadow behind the badge
        doc.setFillColor(15, 23, 42); // Black shadow
        doc.roundedRect(leftX + 0.8, drawY + 0.8, boxW, boxH, 1, 1, 'F');

        // Top white container card with thick black outline borders
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(15, 23, 42); // Black border outline
        doc.setLineWidth(0.45);
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
  doc.text(`Electronic audit record. Generated instantly by ${businessInfo?.name || "Barakah Electronics"}. All rights reserved.`, 105, 288, { align: "center" });

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
  const hasLogoTextSymbol = showLogoSetting && companyLogoStr && !hasLogoImg;

  // Render Left Column: Showroom Identity Info & Prominent Branding Logo
  let brandX = 15;
  let identityY = 18;
  let metaX = 125;
  let metaY = 18;
  let logoWidth = 24;
  let logoHeight = 24;
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
      doc.circle(brandX + 11, identityY + 11, 11, 'F');
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(14 * sizeFactor);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(companyLogoStr, brandX + 11, identityY + 14.5, { align: 'center' });
      hasLogoDrawn = true;
    } catch (e) {
      // ignore
    }
  }

  // Draw Showroom Title Name
  let infoX = hasLogoDrawn ? brandX + logoWidth + 6 : brandX;
  doc.setFont(pdfFontName, "bold");
  
  const singleLineTitle = (businessInfo?.name || "BARAKAH ELECTRONICS").toUpperCase();
  const maxTitleWidth = metaX - infoX - 4; // safe width before metaX
  let titleFontSize = 18 * sizeFactor;
  
  doc.setFontSize(titleFontSize);
  const measuredTitleWidth = doc.getTextWidth(singleLineTitle);
  if (measuredTitleWidth > maxTitleWidth) {
    titleFontSize = Math.max(11, (maxTitleWidth / measuredTitleWidth) * titleFontSize);
    doc.setFontSize(titleFontSize);
  }
  
  doc.setTextColor(15, 23, 42); // slate-900
  let titleY = identityY + 5.5;
  doc.text(singleLineTitle, infoX, titleY);
  titleY = titleY + 6.5 * sizeFactor;

  // Address, phone, email & tax register
  doc.setFont(pdfFontName, "normal");
  doc.setFontSize(8 * sizeFactor);
  doc.setTextColor(71, 85, 105); // slate-600

  let textY = Math.max(titleY + 1.5, identityY + 11);
  const addressLines = doc.splitTextToSize(businessInfo.address || "Showroom Address, Dhaka", maxTitleWidth);
  addressLines.forEach((line: string) => {
    doc.text(line, infoX, textY);
    textY += 4;
  });

  doc.text(`Phone: ${businessInfo.phoneNumber}`, infoX, textY);
  textY += 4;
  if (businessInfo.email) {
    doc.text(`Email: ${businessInfo.email}`, infoX, textY);
    textY += 4;
  }
  if (businessInfo.vatRegNo) {
    doc.text(`VAT Reg No: ${businessInfo.vatRegNo}`, infoX, textY);
    textY += 4;
  }

  let brandYEnd = Math.max(textY, identityY + logoHeight + 4);

  // Render Right Column: Challan Metadata
  let rightY = metaY + 5.5;

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
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'S');

  doc.setFont(pdfFontName, "bold");
  doc.setFontSize(7.5 * sizeFactor);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("DELIVERY TO / CUSTOMER IDENTITY DETAILS", 20, currentY + 5.5);

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
  doc.text(cPhone, 105, currentY + 8.5);
  doc.text(cAddr, 105, currentY + 13.5);

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
  doc.text(`Official Delivery Challan file. Printed by ${businessInfo?.name || "Barakah Electronics"}.`, 105, 288, { align: "center" });

  doc.save(`CHALLAN_${transaction.invoiceNo}_Showroom.pdf`);
}

