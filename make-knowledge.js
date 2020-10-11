const efes = require('fs')
const path = require('path')

const sbd = require('sbd')
const junk = require('junk')

const msgpack = require('@msgpack/msgpack')

const directory = './knowledge-texts'

const DEBUG = process.argv.includes('debug')

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

const getLetters = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-zA-Z]/g, ' ').trim().replace(/\b\w/g, letter => letter.toUpperCase()).replace(/[a-z]/g, ' ').replace(/\s+/g, '').trim()

const repository = {}

const program = async () => {
  let iteration = 0

  for await (const filename of getFiles(directory)) {
    if (!efes.existsSync(filename) || junk.is(filename)) {
      continue
    }

    const contents = efes.readFileSync(filename, 'utf-8')

    console.log(filename)

    const sentences = sbd.sentences(contents, {
      newline_boundaries: true,
    })

    let previous = ''
    for (const sentence of sentences) {
      const cleanSentence = sentence.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F\xAD]/g, '')
      const splits = cleanSentence.split(' ').filter(f => f)
      const splitLength = splits.length

      let carryover = []
      for (const [index, spaceGroup] of splits.entries()) {
        const letters = getLetters(spaceGroup)
        const lowercase = spaceGroup.toLowerCase()

        if (letters) {
          const append = []

          // Discover Appends, DISCARDED FOR NOW
          // let position = index + 1
          // let nextLetters
          // do {
          //   if (position < splitLength) {
          //     const nextGroup = splits[position]

          //     nextLetters = getLetters(nextGroup)
          //     if (!nextLetters) {
          //       append.push(nextGroup)

          //       position += 1
          //     }
          //   }
          // } while (position < splitLength && !nextLetters)

          const compositeLowercase = [...carryover, lowercase, ...append].join(' ')

          if (DEBUG && carryover.length || append.length) {
            console.log('SPECIALS', compositeLowercase)
          }

          carryover = []

          if (!repository[letters]) {
            repository[letters] = {}
          }

          const letterGroup = repository[letters]

          if (!letterGroup[compositeLowercase]) {
            letterGroup[compositeLowercase] = {
              size: 0,
              children: {},
            }
          }

          const cleanGroup = letterGroup[compositeLowercase]

          cleanGroup.size += 1

          if (previous) {
            const previousLetters = getLetters(previous)

            if (!repository[previousLetters][previous].children[letters]) {
              repository[previousLetters][previous].children[letters] = {}
            }

            if (!repository[previousLetters][previous].children[letters][compositeLowercase]) {
              repository[previousLetters][previous].children[letters][compositeLowercase] = 0
            }

            repository[previousLetters][previous].children[letters][compositeLowercase] += 1
          }

          previous = compositeLowercase
        } else {
          carryover.push(spaceGroup)
        }
      }
    }

    // EARLY BREAK
    // if (iteration === 0) {
    //   console.log('PARTIAL DONEZO')

    //   efes.writeFileSync('knowledge.json', JSON.stringify(repository, null, 2))

    //   process.exit()
    // }

    iteration += 1
  }

  console.log('FULL DONEZO')

  const encoded = msgpack.encode(repository)
  const buffer = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength)

  efes.writeFileSync('knowledge.msp', buffer)
}

program()
