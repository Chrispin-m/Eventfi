const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EventManager", function () {
  let EventManager, eventManager;
  let owner, organizer, buyer, platform;
  
  const LISTING_FEE = ethers.utils.parseEther("0.1");
  const TICKET_PRICE = ethers.utils.parseEther("0.5");

  beforeEach(async function () {
    [owner, organizer, buyer, platform] = await ethers.getSigners();
    
    EventManager = await ethers.getContractFactory("EventManager");
    eventManager = await EventManager.deploy();
    await eventManager.deployed();
  });

  describe("Event Creation", function () {
    it("Should create an event with listing fee", async function () {
      const startDate = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
      const endDate = startDate + 86400; // Day after tomorrow

      const tx = await eventManager.connect(organizer).createEvent(
        "Test Event",
        "A test event",
        "Test Location",
        startDate,
        endDate,
        "ipfs://metadata",
        0, // XFI token type
        { value: LISTING_FEE }
      );

      await expect(tx)
        .to.emit(eventManager, "EventCreated")
        .withArgs(1, organizer.address, "Test Event", startDate, endDate);

      const event = await eventManager.getEvent(1);
      expect(event.title).to.equal("Test Event");
      expect(event.organizer).to.equal(organizer.address);
    });

    it("Should add ticket tiers to an event", async function () {
      const startDate = Math.floor(Date.now() / 1000) + 86400;
      const endDate = startDate + 86400;

      await eventManager.connect(organizer).createEvent(
        "Test Event",
        "A test event",
        "Test Location",
        startDate,
        endDate,
        "ipfs://metadata",
        0,
        { value: LISTING_FEE }
      );

      await eventManager.connect(organizer).addTicketTier(
        1,
        "VIP",
        TICKET_PRICE,
        100,
        0 // XFI
      );

      const tier = await eventManager.getTicketTier(1, 0);
      expect(tier.name).to.equal("VIP");
      expect(tier.price).to.equal(TICKET_PRICE);
      expect(tier.maxSupply).to.equal(100);
    });
  });

  describe("Ticket Purchase", function () {
    beforeEach(async function () {
      const startDate = Math.floor(Date.now() / 1000) + 86400;
      const endDate = startDate + 86400;

      await eventManager.connect(organizer).createEvent(
        "Test Event",
        "A test event",
        "Test Location",
        startDate,
        endDate,
        "ipfs://metadata",
        0,
        { value: LISTING_FEE }
      );

      await eventManager.connect(organizer).addTicketTier(
        1,
        "General",
        TICKET_PRICE,
        100,
        0 // XFI
      );
    });

    it("Should allow ticket purchase", async function () {
      const tx = await eventManager.connect(buyer).buyTicket(
        1,
        0,
        "ipfs://ticket-metadata",
        { value: TICKET_PRICE }
      );

      await expect(tx)
        .to.emit(eventManager, "TicketPurchased")
        .withArgs(1, 1, 0, buyer.address, TICKET_PRICE, 0);

      expect(await eventManager.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should verify ticket validity", async function () {
      await eventManager.connect(buyer).buyTicket(
        1,
        0,
        "ipfs://ticket-metadata",
        { value: TICKET_PRICE }
      );

      const verification = await eventManager.verifyTicket(1);
      expect(verification.valid).to.be.false; // Event hasn't started yet
      expect(verification.reason).to.equal("Event has not started");
    });
  });

  describe("Ticket Verification", function () {
    it("Should verify and use ticket during event", async function () {
      const startDate = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const endDate = startDate + 86400;

      await eventManager.connect(organizer).createEvent(
        "Live Event",
        "A live event",
        "Test Location",
        startDate,
        endDate,
        "ipfs://metadata",
        0,
        { value: LISTING_FEE }
      );

      await eventManager.connect(organizer).addTicketTier(
        1,
        "General",
        TICKET_PRICE,
        100,
        0
      );

      await eventManager.connect(buyer).buyTicket(
        1,
        0,
        "ipfs://ticket-metadata",
        { value: TICKET_PRICE }
      );

      const verification = await eventManager.verifyTicket(1);
      expect(verification.valid).to.be.true;

      const tx = await eventManager.connect(organizer).verifyAndUseTicket(1);
      await expect(tx).to.emit(eventManager, "TicketUsed").withArgs(1, 1);
    });
  });
});