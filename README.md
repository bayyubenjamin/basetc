# BaseTC Console

**BaseTC Console** is a Web3 **mining simulation** game designed specifically as a **Farcaster Mini App** and **Frame**. This project enables users to participate in an on-chain gamified ecosystem on the Base network, featuring activities such as Rig NFT purchasing, staking, mining, PvP battles, and social interactions via the Farcaster protocol.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![Farcaster](https://img.shields.io/badge/Farcaster-MiniApp-purple)
![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636)

## 📋 Table of Contents

- [About the Project](#about-the-project)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Key Features](#key-features)
- [Game Mechanics](#game-mechanics)
- [Smart Contracts](#smart-contracts)
- [Project Structure](#project-structure)
- [Installation & Development](#installation--development)

## 📖 About the Project

BaseTC Console serves as the frontend interface for interacting with the BaseTC suite of Smart Contracts. The application detects the user's environment (User Agent) to ensure access is mediated through supported clients such as Warpcast or the Base App. It integrates Web3 wallet authentication and the Farcaster social graph to provide a seamless user experience.

## 🛠 Architecture & Tech Stack

The project is built using a modern architecture that separates **Client-Side**, **Server-Side**, and **On-Chain Logic**.

### Frontend & Framework
- **Core Framework**: [Next.js 14](https://nextjs.org/) (App Router).
- **Language**: TypeScript.
- **Styling**: Tailwind CSS & PostCSS.
- **State Management**: React Query (@tanstack/react-query).

### Web3 & Blockchain Integration
- **Interaction Libraries**: [Wagmi](https://wagmi.sh/) & [Viem](https://viem.sh/) for EVM interactions.
- **Wallet Connection**: ConnectKit.
- **Smart Contract Integration**: Ethers.js & Custom Hooks.
- **Signatures**: EIP-712 Typed Data Signing for secure off-chain verification (`SpinVault`).

### Farcaster Integration
- **SDK**: `@farcaster/miniapp-sdk` for Mini App integration.
- **Viral Loop**: Integrated `sdk.actions.openUrl` to trigger "Cast to Claim" flows.

## 🚀 Key Features

Based on the codebase structure, here are the system's core capabilities:

1.  **Mining Simulation**: The core mechanism where users manage "Rigs" to earn tokens.
2.  **⚔️ Battle Arena (PvP)**: A wagering system where users battle for $BaseTC using their Rig NFTs.
3.  **🎰 Social Spin & Cast**: Daily reward system powered by EIP-712 signatures and Farcaster social actions.
4.  **NFT Integration**: Utilization of `RigNFT` (ERC-1155) with tiered attributes (Basic, Pro, Legend).
5.  **Staking**: Time-locked asset staking with NFT-based yield boosts (`StakingVault`).
6.  **Environment Gating**: Automatic client detection (Warpcast, Base, Ethereum) to restrict access from bots.

### 🆕 New Features (v1.2.0)

- **Battle Arena PvP:** Real-time betting lobbies where the winner takes 95% of the pot. Win probability is calculated based on **RNG + Rig Power**.
- **Cast-to-Claim:** Users must "Cast" their spin results to Warpcast to unlock Leaderboard points, creating a strong viral loop.
- **EIP-712 Security:** Spin rewards are secured using off-chain signatures to prevent botting and gas exploitation.

## 🎮 Game Mechanics

### 1. Battle Arena (PvP)
Users can create or join lobbies with fixed bet amounts (e.g., 10, 50, 100 $BaseTC).
- **Winner Take All:** The winner receives 190% of the bet amount (Total Pot - 5% Treasury Fee).
- **Power Calculation:** Your chance of winning increases based on the NFTs you hold:
  - Base Power: 10
  - Basic Rig: +1 point
  - Pro Rig: +5 points
  - Legend Rig: +20 points
- **Fairness:** The battle logic uses on-chain randomness (`block.prevrandao`) combined with user power scores.

### 2. Social Spin
A "Spin & Cast" mechanic designed for retention and virality.
- **Ticket System:** Users get free spins based on Epochs (every 8 hours) or Referrals.
- **Flow:**
  1.  **Spin:** User signs a message; the backend verifies eligibility and generates an EIP-712 signature.
  2.  **On-Chain Claim:** User submits the signature to `SpinVault` to receive tokens.
  3.  **Cast:** User is prompted to share the win on Farcaster.
  4.  **Points:** Once casted, leaderboard points are credited via the MiniApp SDK.

## ⛓ Smart Contracts

The repository includes Solidity source code (`app/api/solidity/`) which forms the foundation of the on-chain logic:

| Contract | Function Description |
| :--- | :--- |
| **BaseTC.sol** | The main ERC-20 token of the ecosystem. |
| **BattleArena.sol** | **(New)** PvP Logic, Lobby management, and Power calculation. |
| **SpinVault.sol** | **(Updated)** EIP-712 Secured reward distribution for the Spin feature. |
| **RigNFT.sol** | ERC-1155 contract with `BASIC`, `PRO`, and `LEGEND` tiers. |
| **StakingVault.sol** | Logic for staking tokens with time-locks (30d/90d/365d) and NFT boosts. |
| **GameCore.sol** | Primary game logic and interaction orchestration. |
| **ReferralClaimer.sol** | On-chain referral reward distribution. |
| **TreasuryVault.sol** | Management of protocol treasury and revenue. |

## 📂 Project Structure

```bash
basetc-console/
├── app/
│   ├── api/             # API Routes (Next.js) & Solidity Contracts
│   │   ├── frame/       # Endpoints for Farcaster Frames
│   │   ├── solidity/    # Smart Contract source code
│   │   ├── sign-event-action/ # Backend signer for EIP-712
│   │   └── ...          
│   ├── components/      # React UI Components
│   │   ├── Arena.tsx    # Battle Arena Interface
│   │   ├── Spin.tsx     # Spin & Cast Interface
│   │   └── ...
│   ├── context/         # React Context (Web3Provider, FarcasterProvider)
│   ├── lib/             # Utilities, ABIs, and client configuration
│   └── page.tsx         # Entry point with client detection logic
├── public/              # Static assets
└── supabase/            # Supabase Configuration & Edge Functions

🔵 Base Ecosystem Integration
This project is proudly built on Base L2 and designed for the Farcaster ecosystem.

Tech Stack Highlights

Network: Base Mainnet

Framework: Next.js 14 + Farcaster Frames

Integration: Coinbase Smart Wallet & Wagmi

Track: Base Builders January Sprint

Deployed and verified for the Base Builders community.