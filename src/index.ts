import { createApplication } from 'sunnier'
import { promisify } from 'util'
import { join } from 'path'
import * as fs from 'fs'
import * as Koa from 'koa'
const readDirPromise = promisify(fs.readdir)

const rootPath: string = process.cwd()

interface LoadPathInterface {
  controller: string
  service: string
}
interface OptionInterface {
  port: number
  plugins?: Array<Koa.Middleware>
  loadPath?: LoadPathInterface
}

/**
 *
 * @param mode
 * @returns {}
 */
const getOptions = (): OptionInterface =>
  require(join(rootPath, './sunnier.config'))

/**
 *
 * @param paths
 */

const getFilePath = async (jsonPath): Promise<Set<string>> => {
  let filesPath: Set<string> = new Set()

  async function findFile(path) {
    if (!fs.existsSync(path)) {
      console.log(`[sunnier|error]: ${path}不是一个目录或文件`)
      return
    }
    let files: Array<string> = await readDirPromise(path)
    files.forEach(async (item: string) => {
      const fpath: string = join(path, item)
      const stats: fs.Stats = fs.statSync(fpath)
      if (stats.isDirectory()) {
        await findFile(fpath)
      }
      if (stats.isFile()) {
        filesPath.add(fpath)
      }
    })
  }
  await findFile(jsonPath)
  return filesPath
}

/**
 *
 * @param options
 */
const startSunnier = (options: OptionInterface) => {
  return new Promise((resolve, reject) => {
    const app: Koa = createApplication(options)
    app.on('error', err => {
      reject(err)
    })
    app.listen(options.port, () => {
      resolve()
    })
  })
}

const Start = async () => {
  const options: OptionInterface = getOptions()
  const { controller, service } = options.loadPath
  if (controller) {
    let controllerFilesPath: Set<string> = await getFilePath(
      join(rootPath, controller)
    )
    for (let filePath of controllerFilesPath) {
      require(filePath)
    }
  }
  if (service) {
    let serviceFilesPath: Set<string> = await getFilePath(
      join(rootPath, service)
    )
    for (let filePath of serviceFilesPath) {
      require(filePath)
    }
  }
  await startSunnier(options)
  console.log(`server is running ${options.port}`)
}

Start()
