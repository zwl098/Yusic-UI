import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
    const showParticles = ref(true)
    const showSpectrum = ref(true)
    const enableParallax = ref(true)
    const enableHaptics = ref(true)
    const highQualityBlur = ref(true)

    // Load from local storage
    const load = () => {
        const s = localStorage.getItem('yusic_settings')
        if (s) {
            try {
                const parsed = JSON.parse(s)
                if (parsed.showParticles !== undefined) showParticles.value = parsed.showParticles
                if (parsed.showSpectrum !== undefined) showSpectrum.value = parsed.showSpectrum
                if (parsed.enableParallax !== undefined) enableParallax.value = parsed.enableParallax
                if (parsed.enableHaptics !== undefined) enableHaptics.value = parsed.enableHaptics
                if (parsed.highQualityBlur !== undefined) highQualityBlur.value = parsed.highQualityBlur
            } catch (e) {
                console.error('Failed to load settings', e)
            }
        }
    }

    // Initial load
    load()

    // Auto-save
    watch([showParticles, showSpectrum, enableParallax, enableHaptics, highQualityBlur], () => {
        localStorage.setItem('yusic_settings', JSON.stringify({
            showParticles: showParticles.value,
            showSpectrum: showSpectrum.value,
            enableParallax: enableParallax.value,
            enableHaptics: enableHaptics.value,
            highQualityBlur: highQualityBlur.value
        }))
    })

    return {
        showParticles,
        showSpectrum,
        enableParallax,
        enableHaptics,
        highQualityBlur
    }
})
