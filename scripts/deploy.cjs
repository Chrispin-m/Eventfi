const hre = require("hardhat");

async function main() {
  console.log("Deploying EventManager contract to CrossFi testnet...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Check balance
  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance), "XFI");

  if (balance.lt(hre.ethers.utils.parseEther("0.1"))) {
    console.error("Insufficient balance for deployment. Need at least 0.1 XFI for gas fees.");
    process.exit(1);
  }

  // Deploy EventManager
  console.log("Getting contract factory...");
  const EventManager = await hre.ethers.getContractFactory("EventManager");
  
  console.log("Deploying contract...");
  const { maxFeePerGas, maxPriorityFeePerGas } = await hre.ethers.provider.getFeeData();

  const bumpedMaxFee     = maxFeePerGas.add(hre.ethers.utils.parseUnits("1.5", "gwei"));
  const bumpedPriority   = maxPriorityFeePerGas.add(hre.ethers.utils.parseUnits("0.5", "gwei"));

  const eventManager = await EventManager.deploy({
    gasLimit: 12_000_000,
    maxFeePerGas:       bumpedMaxFee,
    maxPriorityFeePerGas: bumpedPriority,
  });

  console.log("Waiting for deployment transaction...");
  await eventManager.deployed();

  console.log("✅ EventManager deployed to:", eventManager.address);
  console.log("📝 Transaction hash:", eventManager.deployTransaction.hash);

  // Wait for block confirmations
  console.log("Waiting for 3 block confirmations...");
  await eventManager.deployTransaction.wait(3);

  console.log("✅ Contract confirmed on blockchain!");

  // Verify contract on CrossFi (if verification is available)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Attempting to verify contract...");
    try {
      await hre.run("verify:verify", {
        address: eventManager.address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified successfully");
    } catch (error) {
      console.log("⚠️  Error verifying contract:", error.message);
      console.log("You can verify manually on the block explorer");
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: eventManager.address,
    transactionHash: eventManager.deployTransaction.hash,
    deploymentTime: new Date().toISOString(),
    deployer: deployer.address,
    gasUsed: eventManager.deployTransaction.gasLimit?.toString(),
    gasPrice: eventManager.deployTransaction.gasPrice?.toString(),
  };

  console.log("\n🎉 Deployment completed successfully!");
  console.log("📋 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📝 Next steps:");
  console.log("1. Copy the contract address above");
  console.log("2. Update your .env file:");
  console.log(`   VITE_EVENT_MANAGER_CONTRACT=${eventManager.address}`);
  console.log("3. Restart your development server");
  console.log(`4. View on explorer: https://scan.testnet.ms/address/${eventManager.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });