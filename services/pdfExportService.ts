import { jsPDF } from 'jspdf';

/**
 * Convert an array of image URLs (data URLs) to a single PDF file
 * @param imageUrls Array of image data URLs
 * @param filename Output filename
 */
export const downloadImagesAsPdf = async (imageUrls: string[], filename: string = 'document.pdf'): Promise<void> => {
    if (imageUrls.length === 0) return;

    // Create PDF document
    // We'll set the orientation based on the first image
    const firstImg = await loadImage(imageUrls[0]);
    const orientation = firstImg.width > firstImg.height ? 'l' : 'p';

    const pdf = new jsPDF({
        orientation: orientation,
        unit: 'px',
        format: [firstImg.width, firstImg.height],
        hotfixes: ['px_scaling'] // Fix for jsPDF unit conversion issues
    });

    // Add first page
    pdf.addImage(imageUrls[0], 'JPEG', 0, 0, firstImg.width, firstImg.height);

    // Add subsequent pages
    for (let i = 1; i < imageUrls.length; i++) {
        const img = await loadImage(imageUrls[i]);
        const pageOrientation = img.width > img.height ? 'l' : 'p';

        pdf.addPage([img.width, img.height], pageOrientation);
        pdf.addImage(imageUrls[i], 'JPEG', 0, 0, img.width, img.height);
    }

    // Save PDF
    pdf.save(filename);
};

/**
 * Helper to load an image from URL
 */
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};
