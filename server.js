const express = require('express');
const firebase = require('firebase/app');
require('firebase/database');

const app = express();
const port = process.env.PORT || 3000;

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyBhATVeER6lVomkHqfvbtcM8j-xhLR8ZyY",
    authDomain: "ff-cash-587aa.firebaseapp.com",
    databaseURL: "https://ff-cash-587aa-default-rtdb.firebaseio.com",
    projectId: "ff-cash-587aa",
    storageBucket: "ff-cash-587aa.appspot.com",
    messagingSenderId: "290002545011",
    appId: "1:290002545011:web:37e5b9ea224a3efaf83d06"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

function seededRandom(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

async function generateAndSaveCandles() {
    console.log("Checking for new candles to generate...");
    const timeframes = [30, 60, 300]; // 30s, 1m, 5m
    const marketPath = "BITCOIN-OTC";
    const now = Date.now();

    for (const tf of timeframes) {
        try {
            const timeframeInMs = tf * 1000;
            const currentPeriodStart = Math.floor(now / timeframeInMs) * timeframeInMs;
            
            const candleRef = database.ref(`markets/${marketPath}/candles/${tf}s`);
            const lastCandleSnapshot = await candleRef.orderByKey().limitToLast(1).once('value');
            
            let lastCandle = null;
            if (lastCandleSnapshot.exists()) {
                lastCandleSnapshot.forEach(child => { lastCandle = child.val(); });
            }

            if (lastCandle && lastCandle.timestamp >= currentPeriodStart) {
                console.log(`Candle for ${tf}s at ${new Date(currentPeriodStart).toLocaleTimeString()} already exists. Skipping.`);
                continue;
            }

            const prevClose = lastCandle ? lastCandle.close : 1.15500;
            const newCandle = generateCandleData(currentPeriodStart, tf, prevClose);
            
            await candleRef.child(newCandle.timestamp).set(newCandle);
            console.log(`Generated ${tf}s candle for ${new Date(newCandle.timestamp).toLocaleTimeString()}`);
        } catch(error) {
            console.error(`Error generating ${tf}s candle:`, error);
        }
    }
}

function generateCandleData(timestamp, timeframe, prevClose) {
    const currentMarket = "BITCOIN OTC";
    const marketSeed = currentMarket.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const period = Math.floor(timestamp / (timeframe * 1000));
    
    const open = prevClose;
    let currentPrice = open;
    const path = [open];
    let momentum = (seededRandom(period * 10 + marketSeed) - 0.5) * 0.25;
    const volatilityFactor = 0.5 + seededRandom(period * 20 + marketSeed) * 1.8;
    
    for (let i = 1; i <= 1000; i++) {
        const stepSeed = period * 1000 + i;
        const randomShock = (seededRandom(stepSeed) - 0.5);
        momentum += (seededRandom(stepSeed + 1) - 0.5) * 0.1;
        momentum *= 0.95;
        const change = (randomShock + momentum) * (0.00002 * volatilityFactor) * Math.sqrt(timeframe);
        currentPrice *= (1 + change);
        path.push(currentPrice);
    }
    return { open, high: Math.max(...path), low: Math.min(...path), close: currentPrice, path, timestamp: timestamp };
}

// Run every 15 seconds
setInterval(generateAndSaveCandles, 15 * 1000); 

// Serve a simple page to show the server is alive
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.listen(port, () => {
    console.log(`Candle generator server listening on port ${port}`);
    generateAndSaveCandles(); // Run once on start
});
