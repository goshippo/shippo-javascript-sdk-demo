import { Shippo } from "shippo";
import os from 'os';
import fs from 'fs';
import path from 'path';
import https from 'https';

const sdk = new Shippo({ apiKeyHeader: "<YOUR API TOKEN>"});

const shipment = await sdk.shipments.create({
  "addressFrom": {
      "name": "Shawn Ippotle",
      "street1": "215 Clayton St.",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94117",
      "country": "US",
      "phone": "+1 555 341 9393",
      "email": "test@gmail.com"
  },
  "addressTo": {
      "name": "Mr. Hippo",
      "street1": "1092 Indian Summer Ct",
      "city": "San Jose",
      "state": "CA",
      "zip": "95122",
      "country": "US",
      "phone": "+1 555 341 9393",
      "email": "test@gmail.com"
  },
  "parcels": [{
      "length": "15",
      "width": "15",
      "height": "15",
      "distanceUnit": "cm",
      "weight": ".2",
      "massUnit": "kg"
  }]
});

console.log (`Shipment ID ${shipment.objectId}`);

// We didn't specify 'async' above, so rates will be returned in the response
shipment.rates.forEach(rate => {
  console.log(`${rate.objectId} ${rate.provider} ${rate.servicelevel.name}, Arrives in ${rate.estimatedDays} days: ${rate.amountLocal}${rate.currencyLocal}`)
});

// Get the lowest rate
const lowestRate = shipment.rates.sort((a, b) => parseFloat(a.amountLocal) - parseFloat(b.amountLocal))[0];

let transaction = await sdk.transactions.create({
    labelFileType: "PDF_4x6",
    metadata: "Order ID #12345",
    rate: lowestRate.objectId
  });

console.log(`Transaction ID ${transaction.objectId}`);

while (transaction.status === "QUEUED") {
  await new Promise(resolve => setTimeout(resolve, 1000));
  transaction = await sdk.transactions.get(transaction.objectId);
}

if (transaction.status === "SUCCESS") {
  console.log(`Label URL: ${transaction.labelUrl}`);
  console.log(`Tracking URL: ${transaction.trackingUrlProvider}`);
  const downloadsFolder = path.join(os.homedir(), 'Downloads');
  const filePath = path.join(downloadsFolder, `${transaction.objectId}.pdf`);

  const file = fs.createWriteStream(filePath);
  await https.get(transaction.labelUrl, (response) => {
      response.pipe(file);
      file.on('finish', () => {
          file.close();
          console.log(`Label downloaded to ${filePath}`);
      });
  }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      console.error(`Error downloading label: ${err.message}`);
  });
}