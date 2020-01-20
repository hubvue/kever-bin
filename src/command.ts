import * as Koa from 'koa'
import * as parseArgv from 'yargs-parser'
import * as assets from 'assert'
import { createApplication } from 'kever'
import { loadFile, getFilesPath } from './util'
import { join } from 'path'
const Logger = console
interface ConfigContext {
  port: number
  host: string
  plugins?: Array<Koa.Middleware>
}

type ArgvOptions = Record<'rootDir' | 'lanType' | 'configFilePath', string>
type genConfig = () => ConfigContext

export class Command {
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
    const options = parseArgv(process.argv.slice(2))
    this.initOptions(options)
  }
  /**
   *
   * @param options
   */
  initOptions(options) {
    const rootDir = options.dir
      ? join(this.baseDir, options.dir)
      : join(this.baseDir, './')
    const lanType =
      options.ts || process.env.NODE_ENV === 'development' ? 'ts' : 'js'
    const configFilePath = join(rootDir, `./config/index.${lanType}`)
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
    let config = typeof genConfig === 'function' && genConfig()
    assets(config, 'config return value must is ConfigContext type value')
    return config
  }
  /**
   *
   */
  async initApplication() {
    return new Promise((resolve, reject) => {
      let config = this.config
      const app = createApplication(config)
      app.on('error', err => {
        reject(err)
      })
      app.listen(config.port, config.host, () => {
        resolve()
      })
    })
  }
  /**
   * @description 启动方法
   */
  async startCommand() {
    let config = this.initConfig()
    config.port = config.port || 9000
    // 获取app目录路径
    const appPath = join(this.options.rootDir, './app')
    // 获取middleare路径
    const middlePath = join(this.options.rootDir, './middleware')
    // 合并config
    Object.assign(this.config, config)
    // get files path
    const [appFilesPath, middleFilesPath] = await Promise.all([
      getFilesPath(appPath),
      getFilesPath(middlePath)
    ])
    // load ts/js file
    Logger.info('[kever|info]: load file...')
    await Promise.all([loadFile(appFilesPath), loadFile(middleFilesPath)])
    Logger.info('[kever|info]: load file done')
    // 初始化Application启动
    this.initApplication()
      .then(() => {
        Logger.info(
          `[kever|info]: service started. address: http://${this.config.host}:${this.config.port}`
        )
        this.watchApplication()
      })
      .catch(err => {
        Logger.error(`[kever|error]: service startup failed. reason: ${err} `)
      })
  }
  /**
   * @description Application development watch mode
   */
  watchApplication() {}
}
