import type { PDFFont } from 'pdf-lib';

export interface CropConfig {
    tlx: number;
    tly: number;
    brx: number;
    bry: number;
    label: string;
    logo: string;
    variants?: {
        id: string;
        label: string;
        tlx: number;
        tly: number;
        brx: number;
        bry: number;
    }[];
    options?: {
        id: string;
        label: string;
    }[];
    disableCrop?: boolean;
}

export type AmazonDescriptionMode = 'WITH_SKU' | 'WITH_DESCRIPTION';

export type PdfJsRawTextItem = {
    str?: string;
    transform?: number[];
};

export type PdfJsTextContent = {
    items: PdfJsRawTextItem[];
};

export type PdfJsPageProxy = {
    getTextContent: () => Promise<PdfJsTextContent>;
};

export type PdfJsDocumentProxy = {
    getPage: (pageNumber: number) => Promise<PdfJsPageProxy>;
};

export type PositionedTextItem = {
    text: string;
    upper: string;
    x: number;
    y: number;
};

export type AmazonInvoiceLineItem = {
    description: string;
    quantity: string | null;
};

export type AmazonInvoiceLabelData = {
    lineItems: AmazonInvoiceLineItem[];
};

export type AmazonSummaryEntry = {
    sku: string;
    totalQty: number;
};

export type MeeshoSummaryEntry = {
    sku: string;
    totalQty: number;
};

export type FlipkartSummaryEntry = {
    sku: string;
    totalQty: number;
};

export type ProcessorOptions = {
    extractSku?: boolean;
    variantId?: string | null;
    selectedOptions?: string[];
    amazonDescriptionMode?: AmazonDescriptionMode;
    includeAmazonOrderSummary?: boolean;
    includeMeeshoOrderSummary?: boolean;
    includeFlipkartOrderSummary?: boolean;
    helveticaFont?: PDFFont | null;
    originalDocProxy?: PdfJsDocumentProxy | null;
};
