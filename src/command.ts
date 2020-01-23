import * as Koa from 'koa'
import * as parseArgv from 'yargs-parser'
import * as assets from 'assert'
import { loadFiles, loadFile, getFilesPath, debounce } from './util'
import { join } from 'path'
import * as chokidar from 'chokidar'
import { fork, exec } from 'child_process'
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
  private watcher
  private work
  private workPid
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
    process.on('exit', () => {
      if (this.workPid) {
        exec(`kill -9 ${this.workPid}`, () => {
          Logger.info('[kever|info]service stopped')
        })
      }
    })
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
    // 初始化watcher
    if (options.watch) {
      this.initWatcher()
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
    await Promise.all([loadFiles(appFilesPath), loadFiles(middleFilesPath)])
    Logger.info('[kever|info]: load file done')
    // 开子进程启动服务
    this.work = fork(join(__dirname, './work'), [], { stdio: 'inherit' })
    this.workPid = this.work.pid
    this.work.on('message', data => {
      if (data && data.error) {
        Logger.error(
          `[kever|error]: service startup failed. reason: ${data.message} `
        )
      } else {
        Logger.info(
          `[kever|info]: service started. address: http://${data.message.host}:${data.message.port}`
        )
        this.watcher && this.watchApplication()
      }
    })
    this.work.send(config)
  }
  /**
   * @description 实例化一个watch
   */
  initWatcher() {
    // 初始化 watcher
    const watchAppPath = join(this.baseDir, './src/app')
    const watchMiddlePath = join(this.baseDir, './src/middleware')
    this.watcher = chokidar.watch([watchAppPath, watchMiddlePath], {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    })
  }
  /**
   * @description Application development watch mode
   */
  watchApplication() {
    this.watcher.on('all', debounce(this.watchHandler.bind(this), 500))
    Logger.info('[kever|info]: files watch...')
  }
  /**
   * @description watch 监听事件处理函数
   * @param event
   * @param path
   */
  watchHandler(event, path) {
    // 文件发生变化，首先查看是否有当前模块作为其它模块的子模块，如果有先在父级模块中将当前模块删除，然后重新加载
    const targetFile = require.resolve(path)
    const cacheModule = require.cache[targetFile]
    const cacheModuleParent = cacheModule && cacheModule.parent
    if (cacheModuleParent) {
      cacheModuleParent.children.splice(
        cacheModuleParent.children.indexOf(cacheModule),
        1
      )
    }
    // 删除文件避免内存泄露，将require.cache中的targetFile删除掉
    delete require.cache[targetFile]
    exec(`kill -9 ${this.workPid}`, err => {
      if (err) {
        Logger.error(`[kever|err] ${err}`)
      }
      this.startCommand()
    })
  }
}
