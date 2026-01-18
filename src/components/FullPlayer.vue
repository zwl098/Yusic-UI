<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { useFavoritesStore } from '@/stores/favorites'
import { useSettingsStore } from '@/stores/settings' // [NEW]
import { parseLrc, type LrcLine } from '@/utils/lrc'
import { getDominantColor } from '@/utils/color'

const musicStore = useMusicStore()
const roomStore = useRoomStore()
const favoritesStore = useFavoritesStore()
const settingsStore = useSettingsStore() // [NEW]

const showSettings = ref(false) // UI toggle

const props = defineProps<{
  show: boolean
}>()
const emit = defineEmits(['close'])

const showLyrics = ref(false)
const lyrics = ref<LrcLine[]>([])
const currentLineIndex = ref(0)
const lyricsContainer = ref<HTMLElement | null>(null)

// Theme Color
const themeColor = ref('#000000')

const updateThemeColor = async (url: string | undefined) => {
    if (!url) {
        themeColor.value = '#000000'
        return
    }
    try {
        const color = await getDominantColor(url)
        themeColor.value = color
    } catch (e) {
        themeColor.value = '#000000'
    }
}

// Watchers
watch(() => musicStore.currentSong?.cover, (val) => {
    updateThemeColor(val)
}, { immediate: true })

// Parse lyrics when song or lyrics change
watch(() => [musicStore.currentSong?.id, musicStore.currentSong?.lrc], ([newId, newLrc]) => {
    // console.log('[FullPlayer] Watcher triggered. ID:', newId, 'LRC length:', newLrc?.length)
    if (!newId || !musicStore.currentSong) {
        lyrics.value = []
        return
    }
    if (newLrc) {
        lyrics.value = parseLrc(newLrc)
    } else {
        lyrics.value = []
    }
    currentLineIndex.value = 0
}, { immediate: true, deep: true })

// Formatting time
const formatTime = (time: number) => {
    const min = Math.floor(time / 60)
    const sec = Math.floor(time % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
}

// Progress and seeking
const progress = computed({
    get: () => (musicStore.currentTime / musicStore.duration) * 100,
    set: (val) => {
        const time = (val / 100) * musicStore.duration
        musicStore.seek(time)
        // roomStore.emitSeek(time)
    }
})

// Sync lyrics
watch(() => musicStore.currentTime, (time) => {
    if (!showLyrics.value) return
    
    // Find current line
    const index = lyrics.value.findIndex((line, i) => {
        const nextLine = lyrics.value[i + 1]
        return time >= line.time && (!nextLine || time < nextLine.time)
    })
    
    if (index !== -1 && index !== currentLineIndex.value) {
        currentLineIndex.value = index
        scrollToCurrentLine()
    }
})

// Scroll when lyrics view opens
watch(showLyrics, (val) => {
    if (val) {
        scrollToCurrentLine()
    }
})

const seekToLine = (line: LrcLine) => {
    if (roomStore.roomId) {
        import('vant').then(({ showToast }) => showToast('Seeking disabled in Listen Together'))
        return
    }
    musicStore.seek(line.time)
    // roomStore.emitSeek(line.time)
    if (!musicStore.isPlaying) {
        musicStore.togglePlay()
    }
}

const onSliderClick = () => {
    if (roomStore.roomId) {
        import('vant').then(({ showToast }) => showToast('Seeking disabled in Listen Together'))
    }
}

const scrollToCurrentLine = () => {
    nextTick(() => {
        if (!lyricsContainer.value) return
        const activeLine = lyricsContainer.value.querySelector('.lrc-line.active') as HTMLElement
        if (activeLine) {
             // Align to 40% height (slightly above center) for better reading flow
             lyricsContainer.value.scrollTo({
                 top: activeLine.offsetTop - lyricsContainer.value.clientHeight * 0.4 + activeLine.clientHeight / 2,
                 behavior: 'smooth'
             })
        }
    })
}

const togglePlay = () => {
    musicStore.togglePlay()
}

const onPrev = () => {
    // Implement prev logic if queue supports history, or just restart
    // For now, simplicity: restart song or do nothing
    musicStore.seek(0)
    // roomStore.emitSeek(0)
}

const onNext = () => {
    musicStore.playNext()
}

// Emotes
const emojis = ['❤️', '🔥', '😂', '🎵', '🕺', '👋']
const emoteContainer = ref<HTMLElement | null>(null)

const sendEmote = (emoji: string) => {
    roomStore.emitEmote(emoji)
}

watch(() => roomStore.lastEmote, (val) => {
    if (val && val.emoji) {
        showEmoteAnimation(val.emoji)
    }
})

const showEmoteAnimation = (emoji: string) => {
    if (!emoteContainer.value) return

    const el = document.createElement('div')
    el.innerText = emoji
    el.className = 'floating-emoji'
    el.style.left = Math.random() * 80 + 10 + '%' // Random horizontal pos
    emoteContainer.value.appendChild(el)

    // Remove after animation
    setTimeout(() => {
        el.remove()
    }, 3000)
}

// Visualizer & Creative Effects
const bgScale = ref(1.2)
const bassScale = ref(1.0) 
let dataArray: Uint8Array | null = null
let animationId: number | null = null
let lastVibrateTime = 0

// 1. 3D Parallax
const cardTransform = ref('')
const onMouseMove = (e: MouseEvent) => {
    if (!props.show || !settingsStore.enableParallax) {
        if (cardTransform.value !== '') cardTransform.value = ''
        return
    }
    const { innerWidth, innerHeight } = window
    const x = (e.clientX / innerWidth - 0.5) * 2 // -1 to 1
    const y = (e.clientY / innerHeight - 0.5) * 2 // -1 to 1
    
    // RotateX is based on Y axis movement, RotateY on X axis
    // Max tilt: 15deg
    cardTransform.value = `perspective(1000px) rotateX(${-y * 15}deg) rotateY(${x * 15}deg)`
}

// Gyro for mobile
const onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (!props.show || !settingsStore.enableParallax) return
    const { beta, gamma } = e // beta: x, gamma: y
    if (beta === null || gamma === null) return
    
    // Clamp values commonly -45 to 45 for viewing
    const x = Math.min(Math.max(gamma, -45), 45) / 45
    const y = Math.min(Math.max(beta - 45, -45), 45) / 45 // Offset beta by 45deg (holding angle)

    cardTransform.value = `perspective(1000px) rotateX(${-y * 15}deg) rotateY(${x * 15}deg)`
}

// 2. Particles & Spectrum
// 2. Particles & Spectrum
const particlesCanvas = ref<HTMLCanvasElement | null>(null)
const spectrumCanvas = ref<HTMLCanvasElement | null>(null)

// Performance Refs for Direct DOM Manipulation
const vinylWrapperRef = ref<HTMLElement | null>(null)
const bgBlurRef = ref<HTMLElement | null>(null)


// Resize observer for full screen canvases
const updateCanvasSize = () => {
    // Cap DPR to 1.5 for performance on high-res screens
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    
    if (particlesCanvas.value) {
        particlesCanvas.value.width = window.innerWidth * dpr
        particlesCanvas.value.height = window.innerHeight * dpr
        initParticles(dpr)
    }
    if (spectrumCanvas.value) {
        spectrumCanvas.value.width = 400 * dpr
        spectrumCanvas.value.height = 400 * dpr
        const ctx = spectrumCanvas.value.getContext('2d')
        if (ctx) ctx.scale(dpr, dpr)
    }
}

class Particle {
    x: number
    y: number
    size: number
    speedX: number
    speedY: number
    opacity: number
    
    constructor(w: number, h: number, dpr: number) {
        this.x = Math.random() * w
        this.y = Math.random() * h
        this.size = (Math.random() * 3 + 1) * dpr
        this.speedX = (Math.random() - 0.5) * 0.5 * dpr
        this.speedY = (Math.random() - 0.5) * 0.5 * dpr
        this.opacity = Math.random() * 0.5 + 0.1
    }
    
    update(w: number, h: number, speedMultiplier: number) {
        this.x += this.speedX * speedMultiplier
        this.y += this.speedY * speedMultiplier
        
        if (this.x < 0) this.x = w
        if (this.x > w) this.x = 0
        if (this.y < 0) this.y = h
        if (this.y > h) this.y = 0
    }
}

let particles: Particle[] = []

const initParticles = (dpr: number) => {
    if (!particlesCanvas.value) return
    const { width, height } = particlesCanvas.value
    particles = []
    // Reduced particle count slightly for mobile
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(width, height, dpr))
    }
}


const startLoop = () => {
    if (!props.show) return 

    // Optimization: If lyrics are fully shown, skip visualizer painting to save GPU for scrolling
    // We keep the loop running for haptics/bass calculation, but skip drawing
    const shouldDraw = !showLyrics.value
    
    const analyser = musicStore.analyser
    
    // Prepare data
    if (analyser && !dataArray) {
        dataArray = new Uint8Array(analyser.frequencyBinCount)
    }
    if (analyser) {
        analyser.getByteFrequencyData(dataArray as any)
    }

    // --- Calcs ---
    let sum = 0
    const currentData = dataArray
    if (currentData && currentData.length >= 10) {
        for (let i = 0; i < 10; i++) {
            const val = currentData[i]
            if (val !== undefined) {
                sum += val
            }
        }
    }
    const average = sum / 10
    const bassLevel = average / 255 // 0.0 to 1.0

    // Smooth Bass Scale
    const targetBass = 1 + bassLevel * 0.15
    bassScale.value += (targetBass - bassScale.value) * 0.3
    
    // Direct DOM manipulation - Bypass Vue Reactivity for 60fps
    if (vinylWrapperRef.value) {
        vinylWrapperRef.value.style.transform = `${cardTransform.value} scale(${bassScale.value})`
    }

    // 4D Haptic Bass (Vibration)
    const now = Date.now()
    if (settingsStore.enableHaptics && average > 210 && now - lastVibrateTime > 300) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15) } catch(e) {}
        }
        lastVibrateTime = now
    }

    const targetBg = 1.2 + bassLevel * 0.1
    bgScale.value += (targetBg - bgScale.value) * 0.1
    
    // Direct DOM manipulation
    if (bgBlurRef.value) {
        bgBlurRef.value.style.transform = `scale(${bgScale.value})`
    }

    // --- Draw Particles ---
    if (settingsStore.showParticles && shouldDraw && particlesCanvas.value) {
        const ctx = particlesCanvas.value.getContext('2d')
        if (ctx) {
            const { width, height } = particlesCanvas.value
            ctx.clearRect(0, 0, width, height)
            
            const speedMult = 1 + bassLevel * 5 
            
            // Optimization: Batch drawing
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
            ctx.beginPath()
            
            particles.forEach(p => {
                p.update(width, height, speedMult)
                ctx.moveTo(p.x + p.size, p.y)
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
            })
            ctx.fill()
        }
    } else if (!settingsStore.showParticles && particlesCanvas.value) {
         // Clear if disabled
         const ctx = particlesCanvas.value.getContext('2d')
         if (ctx) ctx.clearRect(0,0, particlesCanvas.value.width, particlesCanvas.value.height)
    }

    // --- Draw Circular Spectrum ---
    if (settingsStore.showSpectrum && shouldDraw && spectrumCanvas.value && dataArray) {
        const ctx = spectrumCanvas.value.getContext('2d')
        const currentData = dataArray
        if (ctx) {
            const cx = 200
            const cy = 200
            const radius = 140 // Just outside vinyl (vinyl is 280px => 140px radius)
            const bars = 60
            const step = Math.floor(currentData.length / bars)
            
            ctx.clearRect(0, 0, 400, 400)
            
            ctx.beginPath()
            for (let i = 0; i < bars; i++) {
                const val = currentData[i * step] || 0
                const barHeight = (val / 255) * 50 * bassScale.value
                
                const angle = (i / bars) * Math.PI * 2
                
                // Draw bar extending outwards
                const x1 = cx + Math.cos(angle) * (radius + 5)
                const y1 = cy + Math.sin(angle) * (radius + 5)
                const x2 = cx + Math.cos(angle) * (radius + 5 + barHeight)
                const y2 = cy + Math.sin(angle) * (radius + 5 + barHeight)
                
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
            }
            // Style
            ctx.strokeStyle = themeColor.value === '#000000' ? 'rgba(255,255,255,0.5)' : themeColor.value
            ctx.lineWidth = 4
            ctx.lineCap = 'round'
            ctx.stroke()
        }
    } else if (!settingsStore.showSpectrum && spectrumCanvas.value) {
        const ctx = spectrumCanvas.value.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, 400, 400)
    }

    animationId = requestAnimationFrame(startLoop)
}

watch(() => props.show, (val) => {
    if (val) {
        nextTick(() => {
            updateCanvasSize()
            startLoop()
            window.addEventListener('resize', updateCanvasSize)
            window.addEventListener('mousemove', onMouseMove)
            window.addEventListener('deviceorientation', onDeviceOrientation)
        })
    } else {
        if (animationId) cancelAnimationFrame(animationId)
        window.removeEventListener('resize', updateCanvasSize)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('deviceorientation', onDeviceOrientation)
    }
})

onMounted(() => {
    if (props.show && musicStore.analyser) {
        startLoop()
    }
})

watch(() => musicStore.analyser, (newVal) => {
    if (newVal && props.show) {
        startLoop()
    }
})

onUnmounted(() => {
    if (animationId) cancelAnimationFrame(animationId)
    // Close PiP on unmount
    if (pipWindow.value) {
        pipWindow.value.close()
    }
})

// PiP Logic
const isPipSupported = 'documentPictureInPicture' in window
const pipTarget = ref<HTMLElement | null>(null)
const pipWindow = ref<any>(null)

const togglePip = async () => {
    if (pipWindow.value) {
        pipWindow.value.close()
        return
    }

    try {
        // @ts-ignore
        const pip = await window.documentPictureInPicture.requestWindow({
            width: 400,
            height: 150
        })
        
        pipWindow.value = pip

        // Copy styles
        Array.from(document.styleSheets).forEach((styleSheet) => {
            try {
                if (styleSheet.href) {
                     const link = document.createElement('link')
                     link.rel = 'stylesheet'
                     link.type = 'text/css'
                     link.href = styleSheet.href
                     pip.document.head.appendChild(link)
                } else if (styleSheet.cssRules) {
                     const style = document.createElement('style')
                     Array.from(styleSheet.cssRules).forEach(rule => {
                         style.appendChild(document.createTextNode(rule.cssText))
                     })
                     pip.document.head.appendChild(style)
                }
            } catch (e) {
            }
        })

        // Create container, but manual style injection for scope might be needed
        // For simplicity, we inject a root div
        const root = pip.document.createElement('div')
        root.id = 'pip-root'
        root.style.height = '100%'
        pip.document.body.appendChild(root)
        pip.document.body.style.margin = '0'
        
        pipTarget.value = root

        pip.addEventListener('pagehide', () => {
            pipTarget.value = null
            pipWindow.value = null
        })

    } catch (e) {
    }
}

// Swipe to Close
const touchStartY = ref(0)
const touchMoveY = ref(0)
const isDragging = ref(false)

const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
        touchStartY.value = e.touches[0]!.clientY
        isDragging.value = true
    }
}

const onTouchMove = (e: TouchEvent) => {
    if (!isDragging.value || e.touches.length === 0) return

    // If lyrics are shown and not at top, allow scrolling instead of closing
    if (showLyrics.value && lyricsContainer.value && lyricsContainer.value.scrollTop > 0) {
        return
    }

    const deltaY = e.touches[0]!.clientY - touchStartY.value
    if (deltaY > 0) { // Only allow dragging down
        if (e.cancelable) e.preventDefault() // Prevent native pull-to-refresh
        touchMoveY.value = deltaY
    }
}

const onTouchEnd = () => {
    isDragging.value = false
    if (touchMoveY.value > 150) {
        // Close threshold
        emit('close')
    }
    // Reset position logic handles by transition in template binding or simple reset here if using spring physics
    // For simple implementation, we just reset if not closed
    // Ideally we should use a spring library for smooth snapback, but here we just reset
    setTimeout(() => {
        touchMoveY.value = 0
    }, 200)
}


const displayCover = ref('')

watch(() => musicStore.currentSong?.cover, (newUrl) => {
    if (!newUrl) return
    // Preload image to prevent black flash
    const img = new Image()
    img.src = newUrl
    img.onload = () => {
        displayCover.value = newUrl
    }
}, { immediate: true })

// ... existing code ...
</script>

<template>
    <div 
        class="full-player" 
        @touchstart="onTouchStart" 
        @touchmove="onTouchMove" 
        @touchend="onTouchEnd"
        :style="{ transform: `translateY(${touchMoveY}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease-out' }"
    >
    >
        <!-- Background Blur -->
        <div class="bg-blur" ref="bgBlurRef">
             <Transition name="fade-slow">
                 <div 
                    :key="displayCover"
                    class="bg-layer"
                    :style="{ backgroundImage: `url(${displayCover || 'https://via.placeholder.com/300'})` }"
                 ></div>
             </Transition>
        </div>
        <!-- Tint Overlay -->
        <div class="bg-tint" :style="{ background: themeColor }"></div>
        <div class="bg-mask"></div>
        
        <!-- Particles Layer -->
        <canvas 
            ref="particlesCanvas" 
            class="particles-layer" 
            :class="{ hidden: showLyrics }"
        ></canvas>

        <!-- content -->
        <div class="content">
            <!-- Header -->
            <div class="header">
                <van-icon name="arrow-down" size="24" color="white" @click="$emit('close')" />
                <!-- <div class="header-info">
                    <div class="title">{{ musicStore.currentSong?.name }}</div>
                    <div class="artist">{{ musicStore.currentSong?.artist }}</div>
                </div> -->
                <div class="actions">
                     <van-icon 
                        name="setting-o" 
                        size="24" 
                        color="white" 
                        @click="showSettings = true" 
                        style="margin-right: 16px;" 
                    />
                    <van-icon 
                        name="desktop-o" 
                        size="24" 
                        color="white" 
                        @click="togglePip" 
                        v-if="isPipSupported"
                        style="margin-right: 16px;" 
                    />
                    <div class="spacer" v-else></div>
                </div>
            </div>

            <!-- PiP Content (Teleported) -->
            <Teleport :to="pipTarget" v-if="pipTarget">
                <div class="pip-container" @click="togglePlay">
                    <div class="pip-bg" :style="{ backgroundImage: `url(${musicStore.currentSong?.cover})` }"></div>
                    <div class="pip-mask"></div>
                    <div class="pip-content">
                        <div class="pip-line active">
                            {{ lyrics[currentLineIndex]?.text || 'No Lyrics' }}
                        </div>
                        <div class="pip-line next" v-if="lyrics[currentLineIndex + 1]">
                            {{ lyrics[currentLineIndex + 1]?.text }}
                        </div>
                    </div>
                </div>
            </Teleport>


            <!-- Main Area -->
            <div class="main-area">
                <Transition name="fade">
                    <div v-show="!showLyrics" class="vinyl-container" @click="showLyrics = true">
                         <!-- Spectrum Layer -->
                         <canvas ref="spectrumCanvas" class="spectrum-layer"></canvas>
                         
                         
                         <div 
                            class="vinyl-wrapper"
                            ref="vinylWrapperRef"
                        >
                             <!-- Glare for 3D effect -->
                             <div class="vinyl-glare"></div>
                             
                             <div class="stylus" :class="{ playing: musicStore.isPlaying }"></div>
                             <div class="vinyl-disc" :class="{ rotating: musicStore.isPlaying }">
                                 <img :src="musicStore.currentSong?.cover || 'https://via.placeholder.com/300'" class="cover-img" />
                             </div>
                         </div>
                    </div>
                </Transition>

                <Transition name="fade">
                    <div v-show="showLyrics" class="lyrics-wrapper" ref="lyricsContainer" @click="showLyrics = false">
                         <div v-if="lyrics.length === 0" class="no-lyrics">No Lyrics</div>
                         <div 
                           v-else
                            v-for="(line, index) in lyrics" 
                            :key="index" 
                            class="lrc-line"
                            :class="{ active: index === currentLineIndex, interlude: line.isInterlude }"
                          >
                              <span class="lrc-text">{{ line.text }}</span>
                              <van-icon 
                                   name="play-circle-o" 
                                   class="lrc-play-icon" 
                                   @click.stop="seekToLine(line)" 
                              />
                          </div>
                    </div>
                </Transition>
            </div>

            <!-- Controls -->
            <div class="controls-area">
                 <!-- Song Info & Heart (Bottom Layout) -->
                 <div class="bottom-info-row">
                     <div class="text-col">
                         <div class="title-scroller">
                             <div class="main-title">{{ musicStore.currentSong?.name || 'Unknown' }}</div>
                         </div>
                         <div class="sub-artist">{{ musicStore.currentSong?.artist || 'Unknown Artist' }}</div>
                     </div>
                     
                     <div class="action-col">
                        <van-icon 
                            v-if="musicStore.currentSong"
                            :name="favoritesStore.isFavorite(musicStore.currentSong?.id) ? 'like' : 'like-o'"
                            :color="favoritesStore.isFavorite(musicStore.currentSong?.id) ? '#ff4d4f' : '#fff'"
                            class="bottom-like-btn"
                            @click.stop="favoritesStore.toggleFavorite(musicStore.currentSong)"
                        />
                     </div>
                 </div>

                 <!-- Emote Bar -->
                 <div class="emote-bar" v-if="roomStore.roomId">
                      <div 
                        v-for="emoji in emojis" 
                        :key="emoji" 
                        class="emote-btn"
                        @click="sendEmote(emoji)"
                      >
                          {{ emoji }}
                      </div>
                 </div>

                 <!-- Progress Bar -->
                 <div class="progress-bar" @click.capture="onSliderClick">
                      <span class="time-text">{{ formatTime(musicStore.currentTime) }}</span>
                      <van-slider 
                        v-model="progress" 
                        bar-height="4px" 
                        button-size="12px" 
                        active-color="#fff" 
                        inactive-color="rgba(255,255,255,0.3)" 
                        :readonly="!!roomStore.roomId"
                      />
                      <span class="time-text">{{ formatTime(musicStore.duration) }}</span>
                 </div>

                 <!-- Buttons -->
                 <div class="buttons">
                      <van-icon name="arrow-left" size="28" color="white" @click.stop="onPrev" />
                      <div class="play-btn" @click.stop="togglePlay">
                          <van-icon :name="musicStore.isPlaying ? 'pause' : 'play'" size="40" color="#333" />
                      </div>
                      <van-icon name="arrow" size="28" color="white" @click.stop="onNext" />
                 </div>
            </div>
        </div>
        
        <!-- Floating Emotes Container -->
        <div class="floating-emotes" ref="emoteContainer"></div>

        <!-- Settings Popup -->
         <van-popup 
            v-model:show="showSettings" 
            position="bottom" 
            round 
            :style="{ height: 'auto', padding: '24px', background: '#1e1e1e' }"
        >
             <div class="settings-title">Effects & Performance</div>
             
             <div class="setting-item">
                 <span>粒子氛围 (Particles)</span>
                 <van-switch v-model="settingsStore.showParticles" size="20px" active-color="#6200ea" />
             </div>
             
             <div class="setting-item">
                 <span>环形频谱 (Spectrum)</span>
                 <van-switch v-model="settingsStore.showSpectrum" size="20px" active-color="#6200ea" />
             </div>
             
             <div class="setting-item">
                 <span>3D 视差 (Parallax)</span>
                 <van-switch v-model="settingsStore.enableParallax" size="20px" active-color="#6200ea" />
             </div>
             
             <div class="setting-item">
                 <span>震感反馈 (Haptics)</span>
                 <van-switch v-model="settingsStore.enableHaptics" size="20px" active-color="#6200ea" />
             </div>
         </van-popup>
    </div>
</template>
<style scoped>
.full-player {
    position: relative;
    height: 100%;
    width: 100%;
    overflow: hidden;
    color: white;
    display: flex;
    flex-direction: column;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    background: #000;
}

.bg-blur {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    filter: blur(60px) brightness(0.5); /* Darker for better contrast */
    transform: scale(1.5);
    z-index: 0;
    will-change: transform;
    animation: breathe 30s ease-in-out infinite alternate;
}

.full-player::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 3;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    background-size: 150px 150px;
}

@keyframes breathe {
    0% { transform: scale(1.5) rotate(0deg); }
    100% { transform: scale(1.7) rotate(2deg); }
}

.bg-tint {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    opacity: 0.6; /* Intense tint */
    z-index: 1;
    mix-blend-mode: multiply; /* Blends nicely with the dark background */
    transition: background 1s ease;
}

.bg-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    /* Cinematic vignette */
    background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.8) 100%);
    z-index: 1;
}

.content {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 16px;
    height: 60px;
    flex-shrink: 0;
}

.song-info {
    text-align: center;
    color: #fff;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.title-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: 100%;
}

.title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

.like-btn {
    font-size: 20px;
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.like-btn:active {
    transform: scale(1.4);
}

.artist {
    font-size: 14px;
    opacity: 0.8;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.spacer { width: 24px; }

.main-area {
    flex: 1;
    display: grid; 
    grid-template-areas: "content";
    grid-template-rows: 100%; /* Constrain height strictly */
    grid-template-columns: 100%; /* Constrain width strictly */
    overflow: hidden;
    position: relative;
    perspective: 1000px;
}

.vinyl-container {
    grid-area: content;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform, opacity; /* Hint for transition */
    contain: layout paint; /* Optimization: Isolate layout calculations */
}

.lyrics-wrapper {
    grid-area: content;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    /* Optimized padding: Start higher (30vh) to show more content */
    padding: 30vh 0 60vh 0;
    text-align: left;
    mask-image: linear-gradient(
        to bottom, 
        transparent 0%, 
        black 15%, 
        black 85%, 
        transparent 100%
    );
    -webkit-mask-image: linear-gradient(
        to bottom, 
        transparent 0%, 
        black 15%, 
        black 85%, 
        transparent 100%
    );
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    box-sizing: border-box;
    padding-left: 32px;
    padding-right: 32px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s cubic-bezier(0.33, 1, 0.68, 1), transform 0.5s cubic-bezier(0.33, 1, 0.68, 1);
    z-index: 1;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: scale(0.92);
}

.fade-enter-to,
.fade-leave-from {
    opacity: 1;
    transform: scale(1);
}

/* Ultra Premium Vinyl */
.vinyl-wrapper {
    width: 280px;
    height: 280px;
    border-radius: 50%;
    background: #0b0b0b;
    display: flex;
    align-items: center;
    justify-content: center;
    align-items: center;
    justify-content: center;
    /* Static shadow, scales with transform */
    box-shadow: 
        0 20px 40px rgba(0,0,0,0.6),
        0 0 0 8px rgba(255,255,255,0.02), 
        0 0 0 1px rgba(255,255,255,0.1);
    position: relative;
    will-change: transform; /* Hardware acceleration */
}

/* Reflection attempt */
.vinyl-wrapper::before {
    content: '';
    position: absolute;
    bottom: -60px; /* Offset for reflection */
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: inherit;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 60%);
    opacity: 0.3;
    transform: scaleY(0.4);
    filter: blur(10px);
    z-index: -1;
}

.vinyl-disc {
    width: 260px;
    height: 260px;
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 0 0 6px #1a1a1a, inset 0 0 0 12px #000; /* Realistic edge */
}

.vinyl-disc.rotating {
    animation: rotate 30s linear infinite;
}

.cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Particles */
.particles-layer {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 1; /* Between mask and content */
    pointer-events: none;
    transition: opacity 0.5s ease;
}
.particles-layer.hidden {
    opacity: 0;
}

/* Spectrum */
.spectrum-layer {
    position: absolute;
    width: 400px; /* Matching canvas size */
    height: 400px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: -1;
    opacity: 0.8;
}

/* Vinyl Glare */
.vinyl-glare {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%);
    opacity: 0;
    z-index: 10;
    pointer-events: none;
    mix-blend-mode: overlay;
    transition: opacity 0.3s;
}
.vinyl-wrapper:hover .vinyl-glare {
    opacity: 0.3;
}
.vinyl-disc::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: 
        linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%),
        repeating-radial-gradient(#111 0, #111 2px, #222 3px, #222 4px); /* Vinyl grooves */
    mix-blend-mode: overlay;
    border-radius: 50%;
    pointer-events: none;
    opacity: 0.6;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Cinematic Lyrics */
.lyrics-wrapper {
    grid-area: content;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    /* Optimized padding: Start higher (30vh) to show more content */
    padding: 30vh 0 60vh 0;
    text-align: left;
    mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 15%,
        black 85%,
        transparent 100%
    );
    -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 15%,
        black 85%,
        transparent 100%
    );
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    box-sizing: border-box;
    padding-left: 32px;
    padding-right: 32px;
    will-change: transform, opacity; /* Hint for transition */
}

.lrc-line {
    padding: 16px 0;
    opacity: 0.3; /* Adjusted opacity instead of blur */
    transition: all 0.6s cubic-bezier(0.33, 1, 0.68, 1);
    font-size: 22px;
    line-height: 1.5;
    cursor: pointer;
    font-weight: 700;
    /* Removed filter: blur(1.5px) for performance */
    transform-origin: left center;
    color: rgba(255,255,255,0.8);
    letter-spacing: 0.5px;
    content-visibility: auto; /* Huge performance boost for long lists */
    contain-intrinsic-size: 50px; /* Approximate height to prevent scrollbar jumping */
}

.lrc-line:hover {
    opacity: 0.6;
    transform: translateX(10px);
}

.lrc-line.active {
    opacity: 1;
    font-size: 32px; /* Much larger active line */
    color: #fff;
    transform: scale(1.0);
    /* Reduced shadow radius for performance */
    text-shadow: 0 0 15px rgba(255, 255, 255, 0.5);
    margin: 20px 0; /* Extra spacing to isolate the active line */
    will-change: transform, opacity; /* Optimization */
}


.lrc-line.interlude {
    font-family: 'Menlo', monospace;
    font-style: normal;
    font-size: 14px;
    letter-spacing: 2px;
    color: rgba(255, 255, 255, 0.7);
    text-shadow: none;
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 16px;
    border-radius: 20px;
    display: inline-block;
    margin: 10px 0;
    text-transform: uppercase;
    border: 1px solid rgba(255, 255, 255, 0.1);
}


.no-lyrics {
    text-align: center;
    padding-top: 20%;
    font-size: 18px;
    opacity: 0.5;
    letter-spacing: 2px;
}

/* Glass Controls Card */
/* Bottom Info Layout */
.bottom-info-row {
    width: 100%;
    margin-bottom: 20px;
    padding: 0 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.text-col {
    flex: 1;
    overflow: hidden;
    margin-right: 16px;
}

.main-title {
    font-size: 24px;
    font-weight: 700;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.sub-artist {
    font-size: 16px;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bottom-like-btn {
    font-size: 28px;
    padding: 8px;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bottom-like-btn:active {
    transform: scale(0.8);
}

.controls-area {
    margin: 0 16px 30px 16px; 
    padding: 24px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.progress-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
}

.time-text {
    font-size: 11px;
    font-family: 'Menlo', monospace;
    width: 45px;
    text-align: center;
    opacity: 0.6;
}

/* Neon Slider */
:deep(.van-slider__bar) {
    background: linear-gradient(90deg, #fff, #ddd);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}
:deep(.van-slider__button) {
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.8) !important;
    background: #fff;
}

.buttons {
    display: flex;
    align-items: center;
    justify-content: space-evenly;
}

.buttons .van-icon {
    opacity: 0.8;
    transition: all 0.3s;
    filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));
}

.buttons .van-icon:hover {
    opacity: 1;
    filter: drop-shadow(0 0 10px rgba(255,255,255,0.6));
    transform: scale(1.1);
}

.buttons .van-icon:active {
    transform: scale(0.9);
}

.play-btn {
    width: 76px;
    height: 76px;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 30px rgba(255, 255, 255, 0.2);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.play-btn:hover {
    box-shadow: 0 0 40px rgba(255, 255, 255, 0.4);
    transform: scale(1.05);
}

.play-btn:active {
    transform: scale(0.95);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

/* Glass Emote Bar */
.emote-bar {
    display: flex;
    justify-content: flex-start; /* Changed from center to allow proper scrolling */
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
    padding: 12px 20px;
    background: rgba(255,255,255,0.02);
    border-radius: 40px;
    border: 1px solid rgba(255,255,255,0.05);
    backdrop-filter: blur(10px);
    
    max-width: 100%;
    overflow-x: auto;
    white-space: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none; /* Hide scrollbar Firefox */
}

.emote-bar::-webkit-scrollbar {
    display: none; /* Hide scrollbar Chrome/Safari */
}

.emote-btn {
    font-size: 26px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    filter: grayscale(0.5);
}

.emote-btn:hover {
    transform: scale(1.3) rotate(5deg);
    filter: grayscale(0) drop-shadow(0 0 10px rgba(255,255,255,0.4));
}

/* Floating Emotes */
.floating-emotes {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    pointer-events: none;
    z-index: 10;
    overflow: hidden;
}

:deep(.floating-emoji) {
    position: absolute;
    bottom: 220px;
    font-size: 48px;
    animation: floatCinematic 4s ease-out forwards;
    opacity: 0;
    filter: drop-shadow(0 0 15px rgba(255,255,255,0.4));
}

@keyframes floatCinematic {
    0% { transform: translateY(0) scale(0.2) rotate(0deg); opacity: 0; }
    20% { opacity: 1; transform: translateY(-50px) scale(1.2) rotate(15deg); }
    100% { transform: translateY(-600px) scale(0.8) rotate(-15deg); opacity: 0; }
}

/* PiP Styles */
:deep(.pip-container) {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    cursor: pointer; 
    user-select: none;
}

:deep(.pip-bg) {
    position: absolute;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    filter: blur(20px) brightness(0.4); 
    z-index: 0;
    transform: scale(1.2); 
}

:deep(.pip-content) {
    position: relative;
    z-index: 10;
    text-align: center;
    color: white;
    width: 100%;
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

:deep(.pip-line) {
    transition: all 0.4s ease;
    line-height: 1.3;
    padding: 4px 0;
}

:deep(.pip-line.active) {
    font-size: 24px; 
    font-weight: 800;
    background: linear-gradient(to bottom, #fff 0%, #ccc 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
    margin-bottom: 8px;
    max-width: 100%;
}

:deep(.pip-line.next) {
    font-size: 16px;
    opacity: 0.5;
    margin-bottom: 0;
}

.bg-layer {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-size: cover;
    background-position: center;
}

.fade-slow-enter-active,
.fade-slow-leave-active {
    transition: opacity 1.2s ease;
}

.fade-slow-enter-from,
.fade-slow-leave-to {
    opacity: 0;
}
/* Settings */
.settings-title {
    color: white;
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 24px;
    text-align: center;
}

.setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.9);
    font-size: 16px;
}
</style>
