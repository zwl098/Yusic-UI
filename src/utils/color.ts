
export const getDominantColor = (imgUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image()
        img.crossOrigin = 'Anonymous'
        img.src = imgUrl

        img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                resolve('#000000') // Fallback
                return
            }

            canvas.width = 1
            canvas.height = 1

            // Draw 1x1 pixel to average the entire image
            ctx.drawImage(img, 0, 0, 1, 1)

            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
            resolve(`rgb(${r},${g},${b})`)
        }

        img.onerror = () => {
            resolve('#000000')
        }
    })
}
