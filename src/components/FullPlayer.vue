<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { parseLrc, type LrcLine } from '@/utils/lrc'

const musicStore = useMusicStore()
const roomStore = useRoomStore()
const props = defineProps<{
  show: boolean
}>()
defineEmits(['close'])

const showLyrics = ref(false)
const lyrics = ref<LrcLine[]>([])
const currentLineIndex = ref(0)
const lyricsContainer = ref<HTMLElement | null>(null)

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
             lyricsContainer.value.scrollTo({
                 top: activeLine.offsetTop - lyricsContainer.value.clientHeight / 2 + activeLine.clientHeight / 2,
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

// Visualizer
const bgScale = ref(1.2)
let dataArray: Uint8Array | null = null
let animationId: number | null = null

const startLoop = () => {
    if (!props.show) return // Don't run if hidden
    const analyser = musicStore.analyser
    if (!analyser) return

    if (!dataArray) {
        dataArray = new Uint8Array(analyser.frequencyBinCount)
    }
    
    // Fix: Explicit access or confirming type compatibility if needed, 
    // but in browser env Uint8Array should be fine. 
    // The previous error was about SharedArrayBuffer vs ArrayBuffer incompatibility in strict types.
    // Casting 'dataArray' simply works for getByteFrequencyData
    analyser.getByteFrequencyData(dataArray as any)
    
    // Calculate Bass (first ~10 bins)
    let sum = 0
    // Access check
    if (dataArray && dataArray.length >= 10) {
        const arr = dataArray
        for (let i = 0; i < 10; i++) {
            const val = arr[i]
            if (val !== undefined) {
                sum += val
            }
        }
    }
    const average = sum / 10
    
    // Smooth transition
    // Scale: 1.2 (base) + energy benefit
    const targetScale = 1.2 + (average / 255) * 0.15
    bgScale.value += (targetScale - bgScale.value) * 0.2 // Ease
    
    animationId = requestAnimationFrame(startLoop)
}

watch(() => props.show, (val) => {
    if (val) {
        startLoop()
    } else {
        if (animationId) cancelAnimationFrame(animationId)
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
</script>

<template>
    <div class="full-player">
        <!-- Background Blur -->
        <div 
            class="bg-blur" 
            :style="{ 
                backgroundImage: `url(${musicStore.currentSong?.cover})`,
                transform: `scale(${bgScale})`
            }"
        ></div>
        <div class="bg-mask"></div>

        <!-- content -->
        <div class="content">
            <!-- Header -->
            <div class="header">
                <van-icon name="arrow-down" size="24" color="white" @click="$emit('close')" />
                <div class="header-info">
                    <div class="title">{{ musicStore.currentSong?.name }}</div>
                    <div class="artist">{{ musicStore.currentSong?.artist }}</div>
                </div>
                <div class="actions">
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
            <div class="main-area" @click="showLyrics = !showLyrics">
                 <!-- Vinyl Mode -->
                 <div class="vinyl-wrapper" v-show="!showLyrics">
                      <div class="stylus" :class="{ playing: musicStore.isPlaying }"></div>
                      <div class="vinyl-disc" :class="{ rotating: musicStore.isPlaying }">
                          <img :src="musicStore.currentSong?.cover || 'https://via.placeholder.com/300'" class="cover-img" />
                      </div>
                 </div>

                 <!-- Lyrics Mode -->
                 <div class="lyrics-wrapper" v-show="showLyrics" ref="lyricsContainer">
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
            </div>

            <!-- Controls -->
            <div class="controls-area">
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
    animation: breathe 30s ease-in-out infinite alternate;
    will-change: transform;
}

@keyframes breathe {
    0% { transform: scale(1.5) rotate(0deg); }
    100% { transform: scale(1.7) rotate(2deg); }
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
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.header-info {
    text-align: center;
    max-width: 70%;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.title {
    font-size: 20px;
    font-weight: 800;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.5px;
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
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    perspective: 1000px; /* For 3D effects */
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
    box-shadow: 
        0 20px 40px rgba(0,0,0,0.6), /* Deep shadow */
        0 0 0 10px rgba(255,255,255,0.02), /* Outer rim */
        0 0 0 1px rgba(255,255,255,0.1); /* Sharp edge */
    position: relative;
    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
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
    /* Use the same cover image technically? No, hard to do specifically without duplicating img tag. */
    /* Let's just do a shadow reflection */
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
    box-shadow: inset 0 0 20px rgba(0,0,0,1);
}

.vinyl-disc.rotating {
    animation: rotate 30s linear infinite;
}

.cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

/* Glossy Overlays for Vinyl */
.vinyl-disc::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: 
        linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.1) 100%),
        repeating-radial-gradient(rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 2px, transparent 4px);
    border-radius: 50%;
    pointer-events: none;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

/* Cinematic Lyrics */
.lyrics-wrapper {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 50vh 0;
    text-align: left;
    /* Sophisticated mask for smooth fade in/out */
    mask-image: linear-gradient(
        to bottom, 
        transparent 0%, 
        black 25%, 
        black 75%, 
        transparent 100%
    );
    -webkit-mask-image: linear-gradient(
        to bottom, 
        transparent 0%, 
        black 25%, 
        black 75%, 
        transparent 100%
    );
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    box-sizing: border-box;
    padding-left: 32px;
    padding-right: 32px;
}

.lrc-line {
    padding: 16px 0;
    opacity: 0.2; /* Darker inactive */
    transition: all 0.6s cubic-bezier(0.33, 1, 0.68, 1);
    font-size: 22px; 
    line-height: 1.5;
    cursor: pointer;
    font-weight: 700;
    filter: blur(1.5px); /* Stronger blur for stronger focus effect */
    transform-origin: left center;
    color: rgba(255,255,255,0.8);
    letter-spacing: 0.5px;
}

.lrc-line:hover {
    opacity: 0.5;
    filter: blur(0.5px);
    transform: translateX(10px);
}

.lrc-line.active {
    opacity: 1;
    font-size: 32px; /* Much larger active line */
    color: #fff;
    filter: blur(0);
    transform: scale(1.0);
    text-shadow: 0 0 30px rgba(255, 255, 255, 0.6); /* Strong neon glow */
    margin: 20px 0; /* Extra spacing to isolate the active line */
}

.lrc-line.interlude {
    font-family: 'Times New Roman', serif;
    font-style: italic;
    color: #ffd700;
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.no-lyrics {
    text-align: center;
    padding-top: 20%;
    font-size: 18px;
    opacity: 0.5;
    letter-spacing: 2px;
}

/* Glass Controls Card */
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
    justify-content: center;
    gap: 24px;
    margin-bottom: 20px;
    padding: 12px 24px;
    background: rgba(255,255,255,0.02);
    border-radius: 40px;
    border: 1px solid rgba(255,255,255,0.05);
    backdrop-filter: blur(10px);
    width: fit-content;
    margin-left: auto;
    margin-right: auto;
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
</style>
