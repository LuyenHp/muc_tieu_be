/**
 * Nén ảnh và chuyển đổi sang chuỗi Base64
 * Giới hạn dung lượng để phù hợp với Google Sheets (tối đa ~50k ký tự)
 */
export const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300; // Giảm xuống 300px để đảm bảo không vượt quá 50k ký tự Google Sheet
                const MAX_HEIGHT = 300;

                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Nén chất lượng ảnh (giảm xuống 0.7 để dung lượng nhẹ hơn)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                console.log(`Image compressed: ${Math.round(dataUrl.length / 1024)}KB (${dataUrl.length} chars)`);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
