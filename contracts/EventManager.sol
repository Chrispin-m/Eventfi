// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title EventManager
 * @dev Decentralized event ticketing platform supporting multi-person tickets
 */
contract EventManager is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Platform fee recipient
    address public constant PLATFORM_ADDRESS = 0x1f9031A2beA086a591e9872FE3A26F01570A8B2A;
    
    // Token addresses on CrossFi Chain
    address public constant XFI_TOKEN = 0x0000000000000000000000000000000000000000; // Native token
    address public constant XUSD_TOKEN = 0x0000000000000000000000000000000000000001; // Replace with actual
    address public constant MPX_TOKEN = 0x0000000000000000000000000000000000000002; // Replace with actual
    
    // Platform listing fee (1 token unit)
    uint256 public constant LISTING_FEE = 1 ether;
    
    Counters.Counter private _eventIds;
    Counters.Counter private _ticketIds;

    enum TokenType { XFI, XUSD, MPX }
    enum EventStatus { UPCOMING, LIVE, ENDED }

    struct TicketTier {
        string name;
        uint256 pricePerPerson;
        uint256 maxSupply;
        uint256 currentSupply;
        TokenType tokenType;
        bool active;
    }

    struct Event {
        uint256 id;
        address organizer;
        string title;
        string description;
        string location;
        uint256 startDate;
        uint256 endDate;
        string metadataURI;
        bool active;
        mapping(uint256 => TicketTier) tiers;
        uint256 tierCount;
    }

    struct Ticket {
        uint256 id;
        uint256 eventId;
        uint256 tierId;
        address purchaser;
        uint256 attendeeCount;
        uint256 totalAmountPaid;
        uint256 purchaseTimestamp;
        TokenType paymentToken;
        bool used;
        EventStatus eventStatusAtPurchase;
    }

    mapping(uint256 => Event) public events;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256[]) public eventTickets; // eventId => ticketIds[]
    mapping(address => uint256[]) public userTickets; // user => ticketIds[]

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string title,
        uint256 startDate,
        uint256 endDate
    );

    event TicketPurchased(
        uint256 indexed ticketId,
        uint256 indexed eventId,
        uint256 indexed tierId,
        address purchaser,
        uint256 attendeeCount,
        uint256 totalAmount,
        TokenType tokenType,
        uint256 timestamp
    );

    event TicketUsed(
        uint256 indexed ticketId,
        uint256 indexed eventId,
        address indexed organizer
    );

    constructor() ERC721("CrossFi Event Tickets", "CFET") {}

    /**
     * @dev Create a new event (organizer pays listing fee)
     */
    function createEvent(
        string memory title,
        string memory description,
        string memory location,
        uint256 startDate,
        uint256 endDate,
        string memory metadataURI,
        TokenType feeTokenType
    ) external payable nonReentrant returns (uint256) {
        require(startDate > block.timestamp, "Start date must be in future");
        require(endDate > startDate, "End date must be after start date");
        require(bytes(title).length > 0, "Title cannot be empty");

        // Collect listing fee
        _collectListingFee(feeTokenType);

        _eventIds.increment();
        uint256 newEventId = _eventIds.current();

        Event storage newEvent = events[newEventId];
        newEvent.id = newEventId;
        newEvent.organizer = msg.sender;
        newEvent.title = title;
        newEvent.description = description;
        newEvent.location = location;
        newEvent.startDate = startDate;
        newEvent.endDate = endDate;
        newEvent.metadataURI = metadataURI;
        newEvent.active = true;
        newEvent.tierCount = 0;

        emit EventCreated(newEventId, msg.sender, title, startDate, endDate);
        return newEventId;
    }

    /**
     * @dev Add ticket tier to an event
     */
    function addTicketTier(
        uint256 eventId,
        string memory tierName,
        uint256 pricePerPerson,
        uint256 maxSupply,
        TokenType tokenType
    ) external {
        require(events[eventId].organizer == msg.sender, "Only organizer can add tiers");
        require(events[eventId].active, "Event not active");
        require(maxSupply > 0, "Max supply must be greater than 0");
        require(pricePerPerson > 0, "Price must be greater than 0");

        uint256 tierId = events[eventId].tierCount;
        events[eventId].tiers[tierId] = TicketTier({
            name: tierName,
            pricePerPerson: pricePerPerson,
            maxSupply: maxSupply,
            currentSupply: 0,
            tokenType: tokenType,
            active: true
        });
        events[eventId].tierCount++;
    }

    /**
     * @dev Purchase a multi-person ticket for an event
     */
    function buyTicket(
        uint256 eventId,
        uint256 tierId,
        uint256 attendeeCount,
        string memory ticketMetadataURI
    ) external payable nonReentrant returns (uint256) {
        require(attendeeCount > 0, "Attendee count must be greater than 0");
        require(attendeeCount <= 10, "Maximum 10 attendees per ticket");
        
        Event storage eventInfo = events[eventId];
        require(eventInfo.active, "Event not active");
        require(block.timestamp < eventInfo.startDate, "Event has already started");
        require(tierId < eventInfo.tierCount, "Invalid tier ID");

        TicketTier storage tier = eventInfo.tiers[tierId];
        require(tier.active, "Tier not active");
        require(tier.currentSupply + attendeeCount <= tier.maxSupply, "Not enough tickets available");

        // Calculate total payment
        uint256 totalAmount = tier.pricePerPerson * attendeeCount;

        // Collect payment
        _collectPayment(tier.tokenType, totalAmount, eventInfo.organizer);

        // Mint ticket NFT
        _ticketIds.increment();
        uint256 newTicketId = _ticketIds.current();
        
        _safeMint(msg.sender, newTicketId);
        _setTokenURI(newTicketId, ticketMetadataURI);

        // Determine event status at purchase
        EventStatus currentStatus = _getEventStatus(eventInfo.startDate, eventInfo.endDate);

        // Store ticket data
        tickets[newTicketId] = Ticket({
            id: newTicketId,
            eventId: eventId,
            tierId: tierId,
            purchaser: msg.sender,
            attendeeCount: attendeeCount,
            totalAmountPaid: totalAmount,
            purchaseTimestamp: block.timestamp,
            paymentToken: tier.tokenType,
            used: false,
            eventStatusAtPurchase: currentStatus
        });

        eventTickets[eventId].push(newTicketId);
        userTickets[msg.sender].push(newTicketId);
        tier.currentSupply += attendeeCount;

        emit TicketPurchased(
            newTicketId, 
            eventId, 
            tierId, 
            msg.sender, 
            attendeeCount, 
            totalAmount, 
            tier.tokenType,
            block.timestamp
        );
        
        return newTicketId;
    }

    /**
     * @dev Verify and use a ticket (for entry)
     */
    function verifyAndUseTicket(uint256 ticketId) external returns (bool) {
        require(_exists(ticketId), "Ticket does not exist");
        
        Ticket storage ticket = tickets[ticketId];
        Event storage eventInfo = events[ticket.eventId];
        
        require(msg.sender == eventInfo.organizer, "Only organizer can verify tickets");
        require(!ticket.used, "Ticket already used");
        require(block.timestamp >= eventInfo.startDate, "Event has not started");
        require(block.timestamp <= eventInfo.endDate, "Event has ended");

        ticket.used = true;
        emit TicketUsed(ticketId, ticket.eventId, msg.sender);
        return true;
    }

    /**
     * @dev View function to get complete ticket information
     */
    function getTicketInfo(uint256 ticketId) external view returns (
        uint256 id,
        uint256 eventId,
        uint256 tierId,
        address purchaser,
        uint256 attendeeCount,
        uint256 totalAmountPaid,
        uint256 purchaseTimestamp,
        TokenType paymentToken,
        bool used,
        EventStatus eventStatusAtPurchase,
        EventStatus currentEventStatus,
        bool valid,
        string memory reason
    ) {
        require(_exists(ticketId), "Ticket does not exist");
        
        Ticket storage ticket = tickets[ticketId];
        Event storage eventInfo = events[ticket.eventId];
        
        EventStatus currentStatus = _getEventStatus(eventInfo.startDate, eventInfo.endDate);
        (bool isValid, string memory validationReason) = _validateTicket(ticketId);
        
        return (
            ticket.id,
            ticket.eventId,
            ticket.tierId,
            ticket.purchaser,
            ticket.attendeeCount,
            ticket.totalAmountPaid,
            ticket.purchaseTimestamp,
            ticket.paymentToken,
            ticket.used,
            ticket.eventStatusAtPurchase,
            currentStatus,
            isValid,
            validationReason
        );
    }

    /**
     * @dev Get user's tickets
     */
    function getUserTickets(address user) external view returns (uint256[] memory) {
        return userTickets[user];
    }

    /**
     * @dev View function to check ticket validity without modifying state
     */
    function verifyTicket(uint256 ticketId) external view returns (bool valid, string memory reason) {
        return _validateTicket(ticketId);
    }

    /**
     * @dev Get event details
     */
    function getEvent(uint256 eventId) external view returns (
        uint256 id,
        address organizer,
        string memory title,
        string memory description,
        string memory location,
        uint256 startDate,
        uint256 endDate,
        string memory metadataURI,
        bool active,
        uint256 tierCount
    ) {
        Event storage eventInfo = events[eventId];
        return (
            eventInfo.id,
            eventInfo.organizer,
            eventInfo.title,
            eventInfo.description,
            eventInfo.location,
            eventInfo.startDate,
            eventInfo.endDate,
            eventInfo.metadataURI,
            eventInfo.active,
            eventInfo.tierCount
        );
    }

    /**
     * @dev Get ticket tier details
     */
    function getTicketTier(uint256 eventId, uint256 tierId) external view returns (
        string memory name,
        uint256 pricePerPerson,
        uint256 maxSupply,
        uint256 currentSupply,
        TokenType tokenType,
        bool active
    ) {
        require(tierId < events[eventId].tierCount, "Invalid tier ID");
        TicketTier storage tier = events[eventId].tiers[tierId];
        return (tier.name, tier.pricePerPerson, tier.maxSupply, tier.currentSupply, tier.tokenType, tier.active);
    }

    // Internal functions
    function _validateTicket(uint256 ticketId) internal view returns (bool valid, string memory reason) {
        if (!_exists(ticketId)) {
            return (false, "Ticket does not exist");
        }

        Ticket storage ticket = tickets[ticketId];
        Event storage eventInfo = events[ticket.eventId];

        if (ticket.used) {
            return (false, "Ticket already used");
        }

        if (block.timestamp < eventInfo.startDate) {
            return (false, "Event has not started");
        }

        if (block.timestamp > eventInfo.endDate) {
            return (false, "Event has ended");
        }

        return (true, "Valid ticket");
    }

    function _getEventStatus(uint256 startDate, uint256 endDate) internal view returns (EventStatus) {
        if (block.timestamp < startDate) return EventStatus.UPCOMING;
        if (block.timestamp >= startDate && block.timestamp <= endDate) return EventStatus.LIVE;
        return EventStatus.ENDED;
    }

    function _collectListingFee(TokenType tokenType) private {
        if (tokenType == TokenType.XFI) {
            require(msg.value >= LISTING_FEE, "Insufficient XFI for listing fee");
            payable(PLATFORM_ADDRESS).transfer(LISTING_FEE);
            if (msg.value > LISTING_FEE) {
                payable(msg.sender).transfer(msg.value - LISTING_FEE);
            }
        } else {
            address tokenAddress = tokenType == TokenType.XUSD ? XUSD_TOKEN : MPX_TOKEN;
            IERC20(tokenAddress).transferFrom(msg.sender, PLATFORM_ADDRESS, LISTING_FEE);
        }
    }

    function _collectPayment(TokenType tokenType, uint256 amount, address organizer) private {
        if (tokenType == TokenType.XFI) {
            require(msg.value >= amount, "Insufficient XFI payment");
            payable(organizer).transfer(amount);
            if (msg.value > amount) {
                payable(msg.sender).transfer(msg.value - amount);
            }
        } else {
            address tokenAddress = tokenType == TokenType.XUSD ? XUSD_TOKEN : MPX_TOKEN;
            IERC20(tokenAddress).transferFrom(msg.sender, organizer, amount);
        }
    }

    // Override required by Solidity
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}