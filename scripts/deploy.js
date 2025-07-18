const hre = require("hardhat");

async function main() {
  console.log("Deploying EventManager contract...");

  // Deploy EventManager
  const EventManager = await hre.ethers.getContractFactory("EventManager");
  const eventManager = await EventManager.deploy();

  await eventManager.deployed();

  console.log("EventManager deployed to:", eventManager.address);

  // Wait for block confirmations
  await eventManager.deployTransaction.wait(5);

  console.log("Waiting for block confirmations...");

  // Verify contract on CrossFi (if verification is available)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: eventManager.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Error verifying contract:", error.message);
    }
  }

  console.log("Deployment completed!");
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: eventManager.address,
    deploymentTime: new Date().toISOString(),
    deployer: (await hre.ethers.getSigners())[0].address,
  };

  console.log("Deployment Info:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });