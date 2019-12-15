import { createApplication } from 'sunnier'
import { promisify } from 'util'
import { join } from 'path'
import * as fs from 'fs'
const readDirPromise = promisify(fs.readdir)

const rootPath = process.cwd()

/**
 *
 * @param mode

 */

const getOptions = () => require(join(rootPath, './sunnier.config'))

/**
 *
 * @param paths
 */

const getFilePath = async (jsonPath): Promise<Set<string>> => {
  let filesPath: Set<string> = new Set()

  async function findFile(path) {
    let files = await readDirPromise(path)
    files.forEach(async item => {
      let fpath = join(path, item)
      let state = fs.statSync(fpath)
      if (state.isDirectory()) {
        await findFile(fpath)
      }
      if (state.isFile()) {
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
const startSunnier = options => {
  return new Promise((resolve, reject) => {
    const app = createApplication(options)
    app.on('error', err => {
      reject(err)
    })
    app.listen(options.port, () => {
      resolve()
    })
  })
}

const Start = async () => {
  const options = getOptions()
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
