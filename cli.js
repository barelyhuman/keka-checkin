#!/usr/bin/env node

import process from 'node:process'
import dotenv from 'dotenv'
import fs from 'node:fs'

import { program } from 'commander'

// eslint-disable-next-line
import ora from 'ora'

import prompts from 'prompts'
import puppeteer from 'puppeteer'

const spinner = ora('Starting engines...')

// cli context
const ctx = {
  showLogin: false,
  kekaPage: null,
}

const BUTTON_STATUS_MAP = {
  CHECKED_IN: 'clock-out',
  CHECKED_OUT: 'web check-in',
}

const urls = {
  keka: 'https://fountane.keka.com',
  google: 'https://accounts.google.com/',
}

function logger(msg) {
  let existingContent = ''
  if (fs.existsSync('./log.txt')) {
    existingContent = fs.readFileSync('./log.txt')
  }
  fs.writeFileSync('./log.txt', existingContent + '\n' + msg)
}

function validateEnvironment() {
  const requiredVars = []
  requiredVars.forEach(item => {
    if (!process.env[item])
      throw new Error(`Missing Environment Variable: ${item}`)
  })
}

async function logIntoKeka(browser) {
  const page = await browser.newPage()
  await setUserAgent(page)
  const navigationPromise = page.waitForNavigation()
  await page.goto(urls.keka)

  await navigationPromise

  if (ctx.showLogin) {
    await page.waitForSelector('.btn-google-login')
    await page.waitForTimeout(500)
    await page.click('.btn-google-login')
    await navigationPromise
  }

  await page.waitForSelector('.navbar-brand', { timeout: 0 })
  return page
}

async function getKekaClockInStatus(page) {
  logger('into status')
  await page.waitForSelector('home-attendance-clockin-widget button')
  logger('go the clockin widget')
  await page.waitForTimeout(0)
  const status = await page.evaluate(() => {
    const button = document.querySelector(
      'home-attendance-clockin-widget button'
    )

    if (button) {
      return button.innerText
    }
  })

  logger('returing status')

  return status.toLowerCase() === BUTTON_STATUS_MAP.CHECKED_IN
    ? BUTTON_STATUS_MAP.CHECKED_IN
    : BUTTON_STATUS_MAP.CHECKED_OUT
}

async function checkOut(page) {
  try {
    await buttonClick(
      page,
      'home-attendance-clockin-widget.cursor-default div.card.text-white.bg-accent-violet div.card-body.clear-padding.d-flex.flex-column.justify-content-between div.px-12.py-8 div.h-100.d-flex.align-items-center div.d-flex.align-items-center.w-100.justify-content-between div.d-flex.align-items-center div div.mx-4 button.btn.btn-danger.btn-x-sm'
    )
    await buttonClick(
      page,
      'home-attendance-clockin-widget.cursor-default div.card.text-white.bg-accent-violet div.card-body.clear-padding.d-flex.flex-column.justify-content-between div.px-12.py-8 div.h-100.d-flex.align-items-center div.d-flex.align-items-center.w-100.justify-content-between div.d-flex.align-items-center div div button.btn.btn-danger.btn-x-sm.mr-10'
    )
    await page.waitForTimeout(2000)
    await page.click('xhr-confirm-dialog button.btn.btn-primary.btn-sm')
    spinner.succeed('Checked Out')
  } catch (err) {
    logger(err)
    spinner.fail(
      'There was an error checking out, please try again, if it happens again, please check out manually',
      err
    )
  }
}

async function checkIn(page) {
  try {
    await buttonClick(page, 'home-attendance-clockin-widget button')
    await buttonClick(
      page,
      'xhr-confirm-dialog > div.modal-footer > button.btn.btn-primary.btn-sm'
    )
    spinner.succeed('Checked In')
  } catch (err) {
    logger(err)
    spinner.fail(
      'There was an error checking in, please try again, if it happens again, please check in manually',
      err
    )
  }
}

async function confirmUserAction(status, page) {
  if (status === BUTTON_STATUS_MAP.CHECKED_IN) {
    spinner.stop()
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message: "You're checked in, do you want to check out?",
      initial: false,
    })
    spinner.start()
    if (!response.value) return
    checkOut(page)
  } else {
    spinner.stop()
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message: "You aren't checked in, do you want to?",
      initial: false,
    })
    spinner.start()
    if (!response.value) return
    checkIn(page)
  }

  await page.waitForTimeout(5000)
}

async function setUserAgent(page) {
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36'
  )
}

async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: !ctx.showLogin,
    userDataDir: './session',
  })
  const context = browser.defaultBrowserContext()
  await context.overridePermissions(urls.keka, ['geolocation'])
  return browser
}

async function goBonkers(browser, opts) {
  spinner.text = 'Getting keka status...'
  const { kekaPage } = ctx
  const status = await getKekaClockInStatus(kekaPage)

  if (opts.forceCheckIn || opts.forceCheckOut) {
    if (status === BUTTON_STATUS_MAP.CHECKED_IN && opts.forceCheckIn) {
      spinner.info("You're already checked in")
      return
    }
    if (status === BUTTON_STATUS_MAP.CHECKED_OUT && opts.forceCheckOut) {
      spinner.info('You already checked out')
      return
    }

    if (opts.forceCheckIn) checkIn(kekaPage)

    if (opts.forceCheckOut) checkOut(kekaPage)
  } else {
    await confirmUserAction(status, kekaPage)
  }
  await kekaPage.waitForTimeout(3000)
}

async function cli() {
  try {
    program.name('kekacheck').version('1.0.0')

    program
      .option('--login', 'create an initial login')
      .option('--in', 'trigger a check in into keka')
      .option('--out', 'trigger a checkout on into keka')
      .option('--config [path]', 'path to .env containing creds')
      .description(
        `If no flags are provided you will be prompted with the 
	opposite action of the status. 
	
	eg:
		If you are already checked in , it'll ask you if you want to check out
		If you are already checked out , it'll ask you if you want to check in`
      )
      .parse()

    const {
      in: forceIn,
      out: forceOut,
      config: configPath,
      login,
    } = program.opts()

    dotenv.config({
      path: configPath || '.env',
    })

    spinner.start()
    spinner.text = 'Processing...'

    validateEnvironment()

    ctx.showLogin = login

    const browser = await setupBrowser()
    spinner.text = 'Browser up...'

    if (ctx.showLogin) {
      spinner.text = 'Opening keka to login...'
      await logIntoKeka(browser)
      spinner.succeed('Logged in')
      browser.close()
      process.exit(0)
      return
    }

    ctx.kekaPage = await logIntoKeka(browser)
    await goBonkers(browser, {
      forceCheckIn: forceIn,
      forceCheckOut: forceOut,
    })
    browser.close()
    process.exit(0)
  } catch (err) {
    if (spinner.isSpinning) return spinner.fail(err.message)
    console.error(err.message)
    process.exit(1)
  }
}

async function buttonClick(page, selector) {
  await page.evaluate(btnSelector => {
    console.log({ btnSelector })
    document.querySelector(btnSelector).click()
  }, selector)
}

cli()
