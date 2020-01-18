import { createApplication } from 'kever'
import { promisify } from 'util'
import { join } from 'path'
import * as fs from 'fs'
import * as Koa from 'koa'
import * as parseArgv from 'yargs-parser'
import * as assets from 'assert'
const readDirPromise = promisify(fs.readdir)
const Logger = console
interface ConfigContext {
  port: number
  host: string
  plugins?: Array<Koa.Middleware>
}

interface ArgvOptions {
  rootDir: string
  lanType: string
  configFilePath: string
}
type genConfig = () => ConfigContext

export default class Command {
  private baseDir: string
  private options: ArgvOptions
  private config: ConfigContext = {
    host: '127.0.0.1',
    port: 9000
  }
  /**
   *
   */
  constructor() {
    this.baseDir = process.cwd()
    const options: any = parseArgv(process.argv.slice(2))
    this.initOptions(options)
  }
  /**
   *
   * @param options
   */
  initOptions(options: any) {
    const rootDir: string = options.dir
      ? join(this.baseDir, options.dir)
      : join(this.baseDir, './')
    const lanType: string =
      options.ts || process.env.NODE_ENV === 'development' ? 'ts' : 'js'
    const configFilePath: string = join(rootDir, `./config/index.${lanType}`)
    // require ts-node
    if (lanType === 'ts') {
      require('ts-node').register()
    }
    this.options = {
      configFilePath,
      rootDir,
      lanType
    }
  }
  /**
   *
   */
  initConfig(): ConfigContext {
    const genConfig: genConfig = require(this.options.configFilePath).default
    let config: ConfigContext = typeof genConfig === 'function' && genConfig()
    assets(config, 'config return value must is ConfigContext type value')
    return config
  }
  /**
   *
   */
  initKever(): Promise<void> {
    return new Promise((resolve, reject) => {
      let config: ConfigContext = this.config
      const app: Koa = createApplication(config)
      app.on('error', err => {
        reject(err)
      })
      app.listen(config.port, config.host, () => {
        resolve()
      })
    })
  }
  /**
   *
   */
  async startCommand() {
    let config: ConfigContext = this.initConfig()
    config.port = config.port || 9000
    const loadPath = join(this.options.rootDir, './app')
    Object.assign(this.config, config)
    // get files path
    const filesPath: Set<string> = await this.getFilesPath(loadPath)
    // load ts/js file
    Logger.info('[kever|info]: load file...')
    await this.loadFile(filesPath)
    Logger.info('[kever|info]: load file done')
    this.initKever()
      .then(() => {
        Logger.info(
          `[kever|info]: service started. address: http://${this.config.host}:${this.config.port}`
        )
      })
      .catch(err => {
        Logger.error(`[kever|error]: service startup failed. reason: ${err} `)
      })
  }
  /**
   *
   * @param filesPath
   */
  async loadFile(filesPath: Set<string>) {
    for (let filePath of filesPath) {
      await require(filePath)
    }
  }
  /**
   *
   * @param dirs
   */
  async getFilesPath(loadFileDir: string) {
    let filesPath: Set<string> = new Set()

    async function findFile(path) {
      if (!fs.existsSync(path)) {
        Logger.error(`[kever|error]: ${path}is not a file or directory`)
        return
      }
      let files: Array<string> = await readDirPromise(path)
      for (let item of files) {
        const fpath: string = join(path, item)
        const stats: fs.Stats = fs.statSync(fpath)
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
}
