export interface LrcLine {
    time: number
    text: string
    isInterlude?: boolean
}

export function parseLrc(lrc: string | undefined): LrcLine[] {
    if (!lrc) return []

    const lines = lrc.split('\n')
    const result: LrcLine[] = []

    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/

    for (const line of lines) {
        const match = timeReg.exec(line)
        if (match) {
            const minute = parseInt(match[1] || '0')
            const second = parseInt(match[2] || '0')
            const msStr = match[3] || '0'
            const millisecond = parseInt(msStr.length === 2 ? msStr + '0' : msStr)
            const time = minute * 60 + second + millisecond / 1000
            const text = line.replace(timeReg, '').trim()

            if (text) {
                // Check for explicit instrumental tags
                // if (text.match(/^\[(inst|music)\]/i)) ...
                result.push({ time, text })
            }
        }
    }

    // Post-process to add interludes
    const finalResult: LrcLine[] = []
    for (let i = 0; i < result.length; i++) {
        finalResult.push(result[i])

        // If not last line
        if (i < result.length - 1) {
            const current = result[i]
            const next = result[i + 1]
            const gap = next.time - current.time

            // If gap > 12s, insert interlude
            if (gap > 12) {
                finalResult.push({
                    time: current.time + 5, // 5s after current line ends
                    text: '✨ Music... ✨',
                    isInterlude: true
                })
            }
        }
    }

    return finalResult
}
