#!/usr/bin/env node

import dotenv from 'dotenv'
dotenv.config()

import puppeteer from 'puppeteer'
import prompts from 'prompts'
import mri from 'mri'
import ora from 'ora'

const spinner = ora('Starting engines...').start()

const BUTTON_STATUS_MAP = {
	CHECKED_IN: 'clock-out',
	CHECKED_OUT: 'web check-in',
}

const urls = {
	keka: 'https://fountane.keka.com',
	google: 'https://accounts.google.com/',
}

async function logIntoGoogle(browser) {
	const page = await browser.newPage()
	await setUserAgent(page)

	const navigationPromise = page.waitForNavigation()

	await page.goto(urls.google)

	await navigationPromise

	await page.waitForSelector('input[type="email"]')
	await page.click('input[type="email"]')

	await navigationPromise

	await page.type('input[type="email"]', process.env.GOOGLE_EMAIL)

	await page.waitForSelector('#identifierNext')
	await page.click('#identifierNext')

	await page.waitForTimeout(1000)

	await page.waitForSelector('input[type="password"]')
	await page.click('input[type="email"]')
	await page.waitForTimeout(1000)

	await page.type('input[type="password"]', process.env.GOOGLE_PASSWORD)

	await page.waitForSelector('#passwordNext')
	await page.click('#passwordNext')

	await navigationPromise
}

async function logIntoKeka(browser) {
	const page = await browser.newPage()
	await setUserAgent(page)
	const navigationPromise = page.waitForNavigation()
	await page.goto(urls.keka)

	await navigationPromise

	await page.waitForSelector('.btn-google-login')
	await page.waitForTimeout(500)
	await page.click('.btn-google-login')
	await navigationPromise
	await page.waitForTimeout(1000)
	return page
}

async function getKekaClockInStatus(page) {
	await page.waitForSelector('home-attendance-clockin-widget button')
	await page.waitForTimeout(3000)
	const status = await page.evaluate(() => {
		const button = document.querySelector(
			'home-attendance-clockin-widget button',
		)

		if (button) {
			return button.innerText
		}
	})

	return status.toLowerCase() === BUTTON_STATUS_MAP.CHECKED_IN
		? BUTTON_STATUS_MAP.CHECKED_IN
		: BUTTON_STATUS_MAP.CHECKED_OUT
}

async function checkOut(page) {
	try {
		await page.click('home-attendance-clockin-widget button')
		await page.click('home-attendance-clockin-widget button.btn-danger')
		await page.click('xhr-confirm-dialog button.btn.btn-primary.btn-sm')
		spinner.succeed('Checked Out')
	} catch (err) {
		spinner.fail(
			'There was an error checking out, please try again, if it happens again, please check out manually',
			err,
		)
	}
}

async function checkIn(page) {
	try {
		await page.click('home-attendance-clockin-widget button')
		await page.click(
			'xhr-confirm-dialog > div.modal-footer > button.btn.btn-primary.btn-sm',
		)
		spinner.succeed('Checked In')
	} catch (err) {
		spinner.fail(
			'There was an error checking in, please try again, if it happens again, please check in manually',
			err,
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
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36',
	)
}

async function setupBrowser() {
	const browser = await puppeteer.launch({
		headless: true,
	})
	const context = browser.defaultBrowserContext()
	await context.overridePermissions(urls.keka, ['geolocation'])
	return browser
}

async function goBonkers(browser, opts) {
	spinner.text = 'Logging into google...'
	await logIntoGoogle(browser)
	spinner.text = 'Logging into keka...'
	const kekaPage = await logIntoKeka(browser)
	spinner.text = 'Getting keka status...'
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

		if (opts.forceCheckIn) {
			checkIn(kekaPage)
		}
		if (opts.forceCheckOut) {
			checkOut(kekaPage)
		}
	} else {
		await confirmUserAction(status, kekaPage)
	}
	await kekaPage.waitForTimeout(3000)
}

function printHelp() {
	console.log(`
USAGE
-----  
  ./cli.js [flags]

FLAGS
-----
  --in   check you in 
  --out  check you out 

NOTE
----
  If no flags are provided you will be prompted with the 
  opposite action of the status. 

  eg:
	If you are already checked in , it'll ask you if you want to check out
	If you are already checked out , it'll ask you if you want to check in
	
	`)
}

async function cli() {
	const argv = process.argv.slice(2)
	spinner.text = 'Processing...'
	const flags = mri(argv)
	if (flags.help || flags.h) {
		spinner.stop()
		return printHelp()
	}
	const browser = await setupBrowser()
	spinner.text = 'Browser up...'
	await goBonkers(browser, {
		forceCheckIn: flags.in,
		forceCheckOut: flags.out,
	})
	browser.close()
}

cli()
