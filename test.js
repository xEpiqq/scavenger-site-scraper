const Jimp = require('jimp');
const mongoose = require('mongoose')
const AWS = require('aws-sdk')
const chromium = require("@sparticuz/chrome-aws-lambda")
const { addExtra } = require('puppeteer-extra')
const pluginStealth = require('puppeteer-extra-plugin-stealth')

AWS.config.update({ accessKeyId: "AKIA3BC7ARLGHVDKAI74", secretAccessKey: "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", })
const s3 = new AWS.S3()

async function urlParser(url_id) {
    let website_text_two = ''
    if (url_id) {
        website_text_two = (url_id.split('//')[1]).split('/')[0]
        if (website_text_two.includes("www.")) {
            website_text_two = website_text_two.split('www.')[1]
        }
    }
    return website_text_two
}

async function browserLauncher() {
    const puppeteerExtra = addExtra(chromium.puppeteer)
    puppeteerExtra.use(pluginStealth())
    const browser = await puppeteerExtra.launch({
        args: chromium.args, defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath, ignoreHTTPSErrors: true, headless: chromium.headless,
    })
    return browser
}

async function findDesktopLinks(page) {
    const hrefs = await page.$$eval('a', as => as.map(a => a.href))
    return hrefs
}

async function createThumbnailScreenshot(inputBuffer) {
    const image = await Jimp.read(inputBuffer);
    image.resize(150, 94);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  }
  

async function uploadToS3(stripped_url_id, fileStream, thumbnail_screenshot, fileStream2) {
    const uploadParamsDesktop = {
        Bucket: "scavenger-screenshots", Key: `${stripped_url_id}.png`,
        Body: fileStream, ContentType: 'image/png', ACL: 'public-read'
    }
    s3.upload(uploadParamsDesktop, err => err ? console.error("Upload failed") : null);
    const uploadParamsThumbnail = {
        Bucket: "scavenger-screenshots", Key: `thumbnail_${stripped_url_id}.png`,
        Body: thumbnail_screenshot, ContentType: 'image/png', ACL: 'public-read'
    }
    s3.upload(uploadParamsThumbnail, err => err ? console.error("Upload failed") : null);
    const uploadParamsMobile = {
        Bucket: "scavenger-screenshots", Key: `mobile_${stripped_url_id}.png`,
        Body: fileStream2, ContentType: 'image/png', ACL: 'public-read'
    }
    s3.upload(uploadParamsMobile, err => err ? console.error("Upload failed") : null);
}

async function checkTemplate(html) {
    const template_sites = ["wix", "weebly", "godaddy", "wordpress", "shopify", "squarespace", "jimdo", "webnode", "site123", "big cartel", "voog", "yola", "webflow", "zyro", "ucraft", "clickfunnels", "websitebuilder", "zoho", "carrd", "sitebuilder", "site2you", "siteground", "siteorigin", "sitey", "simplesite"];
    const html_lower = html.toLowerCase()
    let templated = {}
    for (let i = 0; i < template_sites.length; i++) {
        const template = template_sites[i]
        const regex = new RegExp(template, 'g')
        const count = (html_lower.match(regex) || []).length
        if (count > 0) {
            templated[template] = count
        }
    }
    let template = 'custom'
    if (Object.keys(templated).length === 0) {
        template = 'custom'
    }
    if (Object.keys(templated).length === 1) {
        template = Object.keys(templated)[0]
    }
    if (Object.keys(templated).length > 1) {
        const template_array = Object.keys(templated)
        const template_count_array = Object.values(templated)
        const max = Math.max(...template_count_array)
        const index = template_count_array.indexOf(max)
        template = template_array[index]
    }
    if (Object.keys(templated).includes('clickfunnels')) {
        template = 'clickfunnels'
    }
}

async function checkIfSecure(page) {
    const current_url = await page.url()
    let secured = false
    if (current_url.includes('https')) {
        secured = true
    }
    return secured
}

// exports.handler =  async function(event, context) {
async function websiteScraper() {
    const mongo_uri = "mongodb+srv://Jaydencrowther:dJIztzr02r8Ii52q@cluster0.jzdvpev.mongodb.net/scav?retryWrites=true&w=majority"
    const list_id = "60b12887-b8c7-450f-9664-22656380ee5d"
    const url_id = "http://masterplumbingsystems.com/"
    const website_text_two = await urlParser(url_id) // first function call
    const browser = await browserLauncher() // second function call

    // open browser go to url and take screenshot (desktop)
    const page = await browser.newPage()
    await page.goto(url_id, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const secured = await checkIfSecure(page) // third function call
    await page.waitForTimeout(2000)
    const html = await page.content()
    const fileStream = await page.screenshot({ encoding: 'binary' })
    const hrefs = await findDesktopLinks(page) // fourth function call
    // open browser go to url and take screenshot (mobile)
    const stripped_url_id = website_text_two.replace(/\./g, '')
    await page.goto(url_id)
    // await page.emulate(puppeteer.devices['iPhone X'])
    await page.waitForTimeout(500)
    const fileStream2 = await page.screenshot({ encoding: 'binary' })
    await browser.close() // close the browser
    const thumbnail_screenshot = await createThumbnailScreenshot(fileStream) // fifth function call
    await uploadToS3(stripped_url_id, fileStream, thumbnail_screenshot, fileStream2) // sixth function call

    const desktop_image_url = `https://scavenger-screenshots.s3.us-west-2.amazonaws.com/${stripped_url_id}.png`
    const thumbnail_image_url = `https://scavenger-screenshots.s3.us-west-2.amazonaws.com/thumbnail_${stripped_url_id}.png`
    const mobile_image_url = `https://scavenger-screenshots.s3.us-west-2.amazonaws.com/mobile_${stripped_url_id}.png`

    let facebook, twitter, instagram, youtube, linkedin, contact_us
    for (let i = 0; i < hrefs.length; i++) {
        if (hrefs[i].includes('facebook')) {
            facebook = hrefs[i]
        }
        if (hrefs[i].includes('twitter')) {
            twitter = hrefs[i]
        }
        if (hrefs[i].includes('instagram')) {
            instagram = hrefs[i]
        }
        if (hrefs[i].includes('youtube')) {
            youtube = hrefs[i]
        }
        if (hrefs[i].includes('linkedin')) {
            linkedin = hrefs[i]
        }
        if (hrefs[i].includes('contact')) {
            contact_us = hrefs[i]
        }
        if (hrefs[i].includes('Contact')) {
            contact_us = hrefs[i]
        }
        if (hrefs[i].includes('CONTACT')) {
            contact_us = hrefs[i]
        }
    }

    // find emails from home html, but if contact exists use the fetch api to find those emails
    const emails = html.match(/[\w.]+@[\w.]+/g)
    const unique_emails = [...new Set(emails)]
    const filtered_emails = unique_emails.filter(email => email.endsWith('.com') || email.endsWith('.org') || email.endsWith('.net') || email.endsWith('.edu') || email.endsWith('.gov') || email.endsWith('.biz') || email.endsWith('.info'))
    let filtered_contact_emails, most_likely_email
    try {
    if (contact_us !== '') {
        const response = await fetch(contact_us)
        const contact_html = await response.text()
        const emails = contact_html.match(/[\w.]+@[\w.]+/g)
        const unique_emails = [...new Set(emails)]
        filtered_contact_emails = unique_emails.filter(email => email.endsWith('.com') || email.endsWith('.org') || email.endsWith('.net') || email.endsWith('.edu') || email.endsWith('.gov') || email.endsWith('.biz') || email.endsWith('.info'))
    }
    if (filtered_contact_emails !== undefined) {
        most_likely_email = filtered_contact_emails[0]
    } else {
        most_likely_email = filtered_emails[0]
    }
} catch (err) {
    console.log(err)
}


    const template = await checkTemplate(html)

    console.log(contact_us)
    console.log(facebook)
    console.log(twitter)
    console.log(instagram)
    console.log(youtube)
    console.log(linkedin)
    console.log(desktop_image_url)
    console.log(mobile_image_url)
    console.log(filtered_emails)
    console.log(filtered_contact_emails)
    console.log(template)

    await mongoose.connect(mongo_uri)
    const sheetSchema = new mongoose.Schema({
        _id: String,
        owner_id: String,
        list_owner: String,
        list_name: String,
        lists: [{
            website: String, biz_name: String, phone: String, templated: String, size: String, address: String, score: Number,
            secured: Boolean, template: String, facebook: String, twitter: String, instagram: String, youtube: String, linkedin: String,
            desktop_screenshot: String, thumbnail_screenshot: String, mobile_screenshot: String, home_emails: Array, contact_emails: Array, preview_email: String
        }],
    })
    const Sheet = mongoose.models.Sheet || mongoose.model('Sheet', sheetSchema);

    // update the sheet
    const data_uploaded = await Sheet.updateOne(
        { _id: list_id, "lists.website": website_text_two },
        {
            $set: {
                "lists.$.secured": secured,
                "lists.$.template": template,
                "lists.$.facebook": facebook,
                "lists.$.twitter": twitter,
                "lists.$.instagram": instagram,
                "lists.$.youtube": youtube,
                "lists.$.linkedin": linkedin,
                "lists.$.desktop_screenshot": desktop_image_url,
                "lists.$.mobile_screenshot": mobile_image_url,
                "lists.$.thumbnail_screenshot": thumbnail_image_url,
                "lists.$.preview_email": most_likely_email,
                "lists.$.home_emails": filtered_emails,
                "lists.$.contact_emails": filtered_contact_emails,
            },
        }
    )


    await mongoose.disconnect(() => {
        console.log('Mongoose connection closed');
    })

    console.log(data_uploaded)

    const response = {
        statusCode: 200,
        body: JSON.stringify({
            secured: secured,
            template: template,
            facebook: facebook,
            twitter: twitter,
            instagram: instagram,
            youtube: youtube,
            linkedin: linkedin,
            desktop_screenshot: desktop_image_url,
            mobile_screenshot: mobile_image_url,
        }),
    }

    return response;
}

websiteScraper()