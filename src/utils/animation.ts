/**
 * Perform a parabola "fly to" animation
 * @param event The mouse event or element that triggered the action
 * @param targetSelector The CSS selector of the target element
 * @param imageSrc The image to fly
 */
export const flyToElement = (startEvent: MouseEvent | HTMLElement, targetSelector: string, imageSrc: string) => {
    const target = document.querySelector(targetSelector)
    if (!target) return

    // Get Start Coordinates
    let startX = 0
    let startY = 0

    if (startEvent instanceof MouseEvent) {
        startX = startEvent.clientX
        startY = startEvent.clientY
    } else {
        const rect = startEvent.getBoundingClientRect()
        startX = rect.left + rect.width / 2
        startY = rect.top + rect.height / 2
    }

    // Get Target Coordinates
    const targetRect = target.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2

    // Create flying element
    const el = document.createElement('img')
    el.src = imageSrc
    el.style.position = 'fixed'
    el.style.width = '50px'
    el.style.height = '50px'
    el.style.borderRadius = '50%'
    el.style.objectFit = 'cover'
    el.style.zIndex = '9999'
    el.style.left = `${startX}px`
    el.style.top = `${startY}px`
    el.style.pointerEvents = 'none'
    el.style.transform = 'translate(-50%, -50%) scale(1)'
    el.style.transition = 'left 0.6s linear, top 0.6s cubic-bezier(0.55, 0, 0.1, 1), transform 0.6s ease-in'

    document.body.appendChild(el)

    // Trigger animation
    requestAnimationFrame(() => {
        el.style.left = `${targetX}px`
        el.style.top = `${targetY}px`
        el.style.transform = 'translate(-50%, -50%) scale(0.2)' // Shrink as it hits
    })

    // Cleanup
    el.addEventListener('transitionend', () => {
        el.remove()
    })
}
