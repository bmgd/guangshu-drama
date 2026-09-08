import ffmpegPath from 'ffmpeg-static'
import ffprobePath from 'ffprobe-static'
import ffmpeg from 'fluent-ffmpeg'
import { existsSync } from 'node:fs'

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)
if (ffprobePath?.path) ffmpeg.setFfprobePath(ffprobePath.path)

export { ffmpeg }

export function probeVideo(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

export function mergeVideos(inputPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (inputPaths.length === 0) {
      reject(new Error('没有可拼接的视频文件'))
      return
    }
    const command = ffmpeg()
    for (const p of inputPaths) {
      if (!existsSync(p)) {
        reject(new Error(`视频文件不存在: ${p}`))
        return
      }
      command.input(p)
    }
    command
      .on('error', reject)
      .on('end', () => resolve())
      .mergeToFile(outputPath, '/tmp')
  })
}

export function burnSubtitle(videoPath: string, subtitlePath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vf', `subtitles=${subtitlePath.replace(/:/g, '\\:')}`])
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

/** 将旁白音频 mux 到视频（替换/添加音轨，视频轨 copy） */
export function muxAudioOntoVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!existsSync(videoPath)) {
      reject(new Error(`视频不存在: ${videoPath}`))
      return
    }
    if (!existsSync(audioPath)) {
      reject(new Error(`音频不存在: ${audioPath}`))
      return
    }
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-shortest',
        '-map', '0:v:0',
        '-map', '1:a:0',
      ])
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

export function extractPosterFrame(videoPath: string, outputPath: string, timeSec = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timeSec)
      .frames(1)
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}
