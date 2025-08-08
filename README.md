# 🎟️ CrossFi Event Ticketing Platform

**A blockchain-powered ticketing experience that makes scalpers cry and fraudsters unemployed.**  
Built on the CrossFi Chain, EventFi supports XFI, XUSD, and MPX token payments, giving event organizers and ticket buyers a secure, transparent, and NFT-verified way to handle events.  

---

## 🌟 What Makes It Different

EventFi is not just “another ticketing website.”  
It’s a **fully decentralized ticketing ecosystem** that:

- **Eliminates Fraud** – Each ticket is minted as an ERC-721 NFT, verifiable on the blockchain.  
- **Accepts Multiple Tokens** – Pay with XFI, XUSD, or MPX.  
- **Works for Any Event** – From music festivals to exclusive online experiences.  
- **Protects Access** – Tickets are tied to verified wallet addresses — no “URL guessing” hacks here.  
- **Feels Effortless** – Intuitive design for buyers, full control for organizers.  

---

## 👥 Who It's For

- **Event Organizers:** Create, manage, and sell tickets securely, knowing each one is authentic.  
- **Ticket Buyers:** Purchase confidently, own your ticket on the blockchain, and breeze through entry.  
- **Event Staff:** Scan and verify tickets in seconds — even without a connected wallet.  

---

## 🛠️ Key Features

### For Event Organizers
- Create events with customizable ticket tiers.
- Accept payments in XFI, XUSD, or MPX.
- Automatic NFT minting for every ticket sold.
- QR code scanning for on-site verification.
- Organizer dashboard with event analytics.

### For Ticket Buyers
- Purchase securely with Web3 wallet integration.
- Receive verifiable NFT tickets stored in your wallet.
- Scannable QR codes for quick entry.
- Guaranteed authenticity and ownership.

### Under the Hood (Technical)
- **Smart Contracts:** Solidity contracts for event creation, ticket sales, and verification.
- **Backend:** Node.js + Express REST API with secure middleware.
- **Frontend:** React + TypeScript + Tailwind CSS for a responsive, mobile-first UI.
- **Web3 Integration:** Ethers.js for seamless blockchain interaction.
- **Security:** Address-level access control, no ticket caching for unverified users.

---

## 🏗️ How It Works — Architecture

```mermaid
graph TD
    User[User Browser / Wallet] -->|Buys Ticket| Frontend[React + TypeScript Frontend]
    Frontend -->|API Call| Backend[Express.js API Server]
    Backend -->|Verify Wallet Ownership| Blockchain[CrossFi Blockchain Network]
    Backend -->|Fetch Metadata| Database[PostgreSQL Database]
    Blockchain --> Backend
    Database --> Backend
    Backend -->|Secure Ticket Data| Frontend
    Frontend -->|Display NFT Ticket + QR| User
    Staff[Event Staff Scanner] -->|Scan QR| Backend
    Backend -->|Verify NFT Ownership| Blockchain
````

---

## 📖 Example User Journey

**1. Event Creation**
An organizer logs in with their Web3 wallet, fills in event details, sets ticket tiers, and chooses accepted payment tokens.

**2. Ticket Purchase**
A buyer browses events, selects a ticket tier, connects their wallet, and confirms the purchase on the blockchain. The system instantly mints an NFT ticket tied to their wallet address.

**3. Event Entry**
At the venue, staff scan the ticket QR code. The backend verifies ownership and validity on the blockchain in real time before granting access.

---

## 🔒 Security by Design

* **Ownership Binding:** Tickets can only be viewed/used by the wallet that purchased them.
* **No Sneak-Ins:** Direct URL access without verification is blocked.
* **Immutable Proof:** All tickets are recorded on the CrossFi blockchain as NFTs.
* **Tamper-Proof Scanning:** QR codes are tied to blockchain verification, not just image matching.

---

## 🌐 Try It Online

No need to set up anything locally.
You can experience the full platform live here: **[EventFi Demo](https://eventfi-vhmz.onrender.com/)**

---

## 📄 Smart Contract Overview

**EventManager.sol** — The core contract for:

* Event creation and management.
* Ticket tier definition and sales.
* NFT minting and ownership verification.
* On-chain ticket usage marking.

**Security Patterns Used:**

* `ReentrancyGuard` for transaction safety.
* `AccessControl` for organizer-only functions.
* Strict input validation.

---

## 💡 Inspiration & Vision

EventFi was born from the frustration of counterfeit tickets, scalping, and lack of transparency in event ticketing. We merged **NFT tech**, **Web3 payments**, and a **smooth user experience** to create a platform that empowers both organizers and attendees — without the shady middlemen.

The vision? A world where buying a ticket is as exciting as attending the event — and as secure as holding a private key.

---

## 🙏 Credits & Acknowledgments

* **CrossFi Chain** – Our blockchain backbone.
* **OpenZeppelin** – For secure smart contract libraries.
* **React & Ethers.js Communities** – For powering the frontend and blockchain connections.
* And the countless event-goers who inspired us to build something better.

---

Built with ❤️ for the CrossFi ecosystem.
