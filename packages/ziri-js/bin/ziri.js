#!/usr/bin/env node
import { main } from '../lib/cli.js';
main().catch(err => { console.error(err?.stack || err); process.exit(1); });
