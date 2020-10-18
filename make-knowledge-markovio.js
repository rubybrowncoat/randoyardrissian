const efes = require('fs')
const path = require('path')

const junk = require('junk')

const markov = require('./markovio')

async function* getFiles(dir) {
  const dirents = await efes.promises.readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}

const directory = './knowledge-texts'
const dataset = markov.newDataSet()

let preserveLineBreaks = true

const program = async () => {
  const files = []
  for await (const filename of getFiles(directory)) {
    if (!efes.existsSync(filename) || junk.is(filename)) {
      continue
    }

    files.push(filename)
  }

  dataset.trainOnFile(files, preserveLineBreaks, function () {
    dataset.export()
  })
}

program()