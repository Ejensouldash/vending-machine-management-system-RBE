
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { VM_CONFIG } from '@/lib/vm-config';
import { promises as fs } from 'fs';
import path from 'path';

// OPSG Specification v1.6.4.4 Implementation

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const merchantCode = (formData.get('MerchantCode') as string) || '';
    const paymentId = (formData.get('PaymentId') as string) || '';
    const refNo = (formData.get('RefNo') as string) || '';
    const amount = (formData.get('Amount') as string) || '0';
    const currency = (formData.get('Currency') as string) || 'MYR';
    const status = (formData.get('Status') as string) || '0';
    const receivedSignature = (formData.get('Signature') as string) || '';

    // 1. Signature Verification (server-side using Node crypto)
    const cleanAmount = amount.replace(/[.,]/g, '');
    const sourceStr = `${VM_CONFIG.MERCHANT.KEY}${merchantCode}${paymentId}${refNo}${cleanAmount}${currency}${status}`;

    const calculatedSignature = crypto.createHash('sha512').update(sourceStr).digest('base64');

    if (calculatedSignature !== receivedSignature) {
      console.error('iPay88: Signature mismatch');
      return new NextResponse('Error', { status: 400 });
    }

    // If not successful payment, acknowledge and exit (iPay88 expects RECEIVEOK)
    if (status !== '1') {
      return new NextResponse('RECEIVEOK', { status: 200 });
    }

    // Identify slot from RefNo
    const parts = refNo.split('-');
    const slotId = parts.find(p => p.startsWith('SLOT')) || null;

    // Persist callback to disk (server-side storage)
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });

    const callbacksPath = path.join(dataDir, 'ipay88_callbacks.json');
    let callbacks: any[] = [];
    try {
      const existing = await fs.readFile(callbacksPath, 'utf-8');
      callbacks = JSON.parse(existing || '[]');
    } catch (e) {
      callbacks = [];
    }

    const callbackRecord = {
      id: crypto.randomUUID(),
      merchantCode,
      paymentId,
      refNo,
      amount: parseFloat(amount),
      currency,
      status,
      signature: receivedSignature,
      slotId,
      receivedAt: new Date().toISOString()
    };

    callbacks.unshift(callbackRecord);
    await fs.writeFile(callbacksPath, JSON.stringify(callbacks, null, 2), 'utf-8');

    // Also append a simple server-side transaction record to data/transactions.json
    const txPath = path.join(dataDir, 'transactions.json');
    let txs: any[] = [];
    try {
      const t = await fs.readFile(txPath, 'utf-8');
      txs = JSON.parse(t || '[]');
    } catch (e) {
      txs = [];
    }

    const productConfig = VM_CONFIG.SLOTS.find(s => s.id === slotId) || null;
    const newTx = {
      id: crypto.randomUUID(),
      refNo,
      paymentId,
      productName: productConfig ? productConfig.name : 'UNKNOWN',
      slotId: slotId || 'UNKNOWN',
      amount: parseFloat(amount) || 0,
      currency,
      status: 'SUCCESS',
      paymentMethod: 'E-Wallet',
      timestamp: new Date().toISOString()
    };

    txs.unshift(newTx);
    await fs.writeFile(txPath, JSON.stringify(txs, null, 2), 'utf-8');

    console.log(`iPay88: Persisted payment ${paymentId} for ${slotId} RM ${amount}`);

    return new NextResponse('RECEIVEOK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    console.error('iPay88 Backend Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}
