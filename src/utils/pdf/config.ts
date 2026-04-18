import type { CropConfig } from './types';

export const LABEL_CONFIGS: Record<string, CropConfig> = {
    FLIPKART: {
        tlx: 188,
        tly: 28,
        brx: 407,
        bry: 381,
        label: "Flipkart",
        logo: "./Flipkart.jpg"
    },
    MEESHO: {
        tlx: 0,
        tly: 0,
        brx: 600,
        bry: 660,
        label: "Meesho",
        logo: "./Meesho2.jpg",
        variants: [
            {
                id: 'without_invoice',
                label: 'Without Invoice',
                tlx: 0,
                tly: 0,
                brx: 600,
                bry: 358
            },
            {
                id: 'with_invoice',
                label: 'With Invoice',
                tlx: 0,
                tly: 0,
                brx: 600,
                bry: 660
            }
        ]
    },
    AMAZON: {
        tlx: 0,
        tly: 0,
        brx: 210,
        bry: 465,
        label: "Amazon",
        logo: "./Amazon2.jpg",
        options: [
            {
                id: 'order_page',
                label: 'Select Only Order Page'
            }
        ],
        disableCrop: true
    }
};
