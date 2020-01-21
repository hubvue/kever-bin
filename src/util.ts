import * as fs from 'fs'
import { promisify } from 'util'
import { join } from 'path'
const readDirPromise = promisify(fs.readdir)

const Logger = console
/**
 * @description require .ts | .js file
 * @param filesPath
 */
export const loadFiles = async (filesPath: Set<string>) => {
  for (let filePath of filesPath) {
    await loadFile(filePath)
  }
}
export const loadFile = async (filePath: string) => {
  await require(filePath)
}

/**
 * @description 深度获取指定目录下的所有文件
 * @param dirs
 */
export const getFilesPath = async (
  loadFileDir: string
): Promise<Set<string>> => {
  let filesPath: Set<string> = new Set()

  async function findFile(path) {
    if (!fs.existsSync(path)) {
      Logger.error(`[kever|error]: ${path}is not a file or directory`)
      return
    }
    let files = await readDirPromise(path)
    for (let file of files) {
      const fpath = join(path, file)
      const stats = fs.statSync(fpath)
      if (stats.isDirectory()) {
        await findFile(fpath)
      }
      if (stats.isFile()) {
        filesPath.add(fpath)
      }
    }
  }
  await findFile(loadFileDir)
  return filesPath
}

export const debounce = (fn: Function, time: number): Function => {
  let timer = null
  return (...args) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      fn.apply(null, args)
    }, time)
  }
}
