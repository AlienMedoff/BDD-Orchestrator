import { toNano, TonClient, WalletContractV4, internal, fromNano, address } from "ton";
import { mnemonicNew, mnemonicToPrivateKey } from "ton-crypto";
import { AetherVault } from "./contracts/AetherVault";
import { AetherOracle } from "./contracts/AetherOracle";
import { AetherGovernance } from "./contracts/AetherGovernance";

// TON client configuration
const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2",
    apiKey: process.env.TON_API_KEY,
});

// Deploy configuration
const deployConfig = {
    network: "testnet",
    gasLimit: toNano(0.1),
    timeout: 30000,
};

// Contract deployment class
class ContractDeployer {
    private client: TonClient;
    private wallet: WalletContractV4;
    private keyPair: { publicKey: Buffer; secretKey: Buffer };

    constructor() {
        this.client = client;
    }

    // Initialize wallet
    async initializeWallet() {
        const mnemonic = process.env.WALLET_MNEMONIC || (await mnemonicNew()).join(" ");
        this.keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
        
        this.wallet = WalletContractV4.create({
            publicKey: this.keyPair.publicKey,
            workchain: 0,
        });
        
        console.log(`Wallet address: ${this.wallet.address.toString()}`);
    }

    // Deploy AetherVault
    async deployAetherVault() {
        console.log("🚀 Deploying AetherVault...");
        
        const aetherVault = AetherVault.fromInit(
            this.keyPair.publicKey, // owner
            address("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMTc"), // guardian1
            address("EQBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB") // guardian2
        );

        const deployContract = aetherVault;
        const seqno = await this.client.getWalletSeqno(this.wallet.address);
        
        const deployMessage = internal({
            to: deployContract.address,
            value: deployConfig.gasLimit,
            body: deployContract.createInitCode(),
        });

        await this.client.sendExternalMessage(this.wallet, {
            seqno,
            secretKey: this.keyPair.secretKey,
            messages: [deployMessage],
        });

        console.log(`✅ AetherVault deployed at: ${deployContract.address.toString()}`);
        return deployContract.address;
    }

    // Deploy AetherOracle
    async deployAetherOracle() {
        console.log("🚀 Deploying AetherOracle...");
        
        const aetherOracle = AetherOracle.fromInit(
            this.keyPair.publicKey, // owner
            2 // threshold
        );

        const deployContract = aetherOracle;
        const seqno = await this.client.getWalletSeqno(this.wallet.address);
        
        const deployMessage = internal({
            to: deployContract.address,
            value: deployConfig.gasLimit,
            body: deployContract.createInitCode(),
        });

        await this.client.sendExternalMessage(this.wallet, {
            seqno,
            secretKey: this.keyPair.secretKey,
            messages: [deployMessage],
        });

        console.log(`✅ AetherOracle deployed at: ${deployContract.address.toString()}`);
        return deployContract.address;
    }

    // Deploy AetherGovernance
    async deployAetherGovernance() {
        console.log("🚀 Deploying AetherGovernance...");
        
        const aetherGovernance = AetherGovernance.fromInit(
            this.keyPair.publicKey, // owner
            7 * 24 * 60 * 60, // voting period (7 days)
            2 * 24 * 60 * 60  // timelock period (48 hours)
        );

        const deployContract = aetherGovernance;
        const seqno = await this.client.getWalletSeqno(this.wallet.address);
        
        const deployMessage = internal({
            to: deployContract.address,
            value: deployConfig.gasLimit,
            body: deployContract.createInitCode(),
        });

        await this.client.sendExternalMessage(this.wallet, {
            seqno,
            secretKey: this.keyPair.secretKey,
            messages: [deployMessage],
        });

        console.log(`✅ AetherGovernance deployed at: ${deployContract.address.toString()}`);
        return deployContract.address;
    }

    // Deploy all contracts
    async deployAll() {
        console.log("🚀 Starting contract deployment...");
        
        await this.initializeWallet();
        
        // Check wallet balance
        const balance = await this.client.getBalance(this.wallet.address);
        console.log(`💰 Wallet balance: ${fromNano(balance)} TON`);
        
        if (balance < toNano(1)) {
            throw new Error("Insufficient balance for deployment");
        }

        // Deploy contracts
        const vaultAddress = await this.deployAetherVault();
        const oracleAddress = await this.deployAetherOracle();
        const governanceAddress = await this.deployAetherGovernance();

        console.log("✅ All contracts deployed successfully!");
        
        return {
            vault: vaultAddress,
            oracle: oracleAddress,
            governance: governanceAddress,
        };
    }

    // Test contract interaction
    async testContracts(addresses: { vault: string; oracle: string; governance: string }) {
        console.log("🧪 Testing contract interactions...");
        
        // Test AetherVault
        const vault = AetherVault.fromAddress(address(addresses.vault));
        const vaultData = await vault.getGetVaultData();
        console.log("🔐 AetherVault data:", vaultData);

        // Test AetherOracle
        const oracle = AetherOracle.fromAddress(address(addresses.oracle));
        const oracleData = await oracle.getGetOracleData();
        console.log("🔮 AetherOracle data:", oracleData);

        // Test AetherGovernance
        const governance = AetherGovernance.fromAddress(address(addresses.governance));
        const governanceData = await governance.getGetGovernanceData();
        console.log("🏛️ AetherGovernance data:", governanceData);
    }
}

// Main deployment function
async function main() {
    try {
        const deployer = new ContractDeployer();
        
        // Deploy contracts
        const addresses = await deployer.deployAll();
        
        // Test contracts
        await deployer.testContracts(addresses);
        
        console.log("🎉 Deployment completed successfully!");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Export for use in other modules
export { ContractDeployer };

// Run if called directly
if (require.main === module) {
    main();
}
