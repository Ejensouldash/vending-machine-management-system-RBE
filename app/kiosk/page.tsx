import React, { useState } from 'react';
import { VM_CONFIG } from '@/lib/vm-config';
import { constructRequestSignature, generateSignature } from '@/services/crypto';
import { ShoppingCart, CreditCard } from 'lucide-react';

// This is the "Vending Machine Screen" seen by the customer
export default function KioskPage() {
  const [selectedSlot, setSelectedSlot] = useState(VM_CONFIG.SLOTS[0]);
  const [loading, setLoading] = useState(false);

  const handleBuy = async () => {
    setLoading(true);

    try {
      // 1. Prepare Data
      const refNo = `ORD-${selectedSlot.id}-${Date.now()}`; // Unique RefNo
      const amount = selectedSlot.price.toFixed(2);
      const currency = "MYR";
      
      // 2. Generate Signature (Client-side for demo, usually Server-side for security)
      // Note: In real production, signature generation should happen via an API call to your server 
      // so you don't expose the MerchantKey in the browser. 
      // Note: For demo purposes the signature is generated in-browser here.
      
      const sourceStr = constructRequestSignature(
        VM_CONFIG.MERCHANT.KEY,
        VM_CONFIG.MERCHANT.CODE,
        refNo,
        amount,
        currency,
        "" // xfield1 (empty but required in hash order)
      );

      const signature = await generateSignature(sourceStr, VM_CONFIG.MERCHANT.KEY);

      // 3. Create a Form and Submit it (Redirect to iPay88)
      // We use a hidden form approach to perform the POST redirect
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://payment.ipay88.com.my/epayment/entry.asp';

      const fields = {
        MerchantCode: VM_CONFIG.MERCHANT.CODE,
        PaymentId: "", // Empty for Gateway Selection page
        RefNo: refNo,
        Amount: amount,
        Currency: currency,
        ProdDesc: selectedSlot.name,
        UserName: "Vending Customer",
        UserEmail: "customer@example.com", // Optional or dummy
        UserContact: "0123456789",         // Optional or dummy
        Remark: "Vending Machine Purchase",
        Lang: "UTF-8",
        SignatureType: "HMACSHA512",
        Signature: signature,
        ResponseURL: "https://your-ngrok-url.ngrok-free.app/receipt", // Replace with real URL
        BackendURL: "https://your-ngrok-url.ngrok-free.app/api/ipay88/backend" // Replace with real URL
      };

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

    } catch (err) {
      console.error(err);
      alert("Error generating payment request");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-indigo-600 p-6 text-center">
          <h1 className="text-2xl font-bold text-white">Vending Kiosk</h1>
          <p className="text-indigo-200 text-sm">Select a drink to purchase</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Select Product</label>
            <div className="grid grid-cols-1 gap-2">
              {VM_CONFIG.SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    selectedSlot.id === slot.id 
                      ? 'border-indigo-600 bg-indigo-50' 
                      : 'border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-bold text-slate-800">{slot.name}</div>
                    <div className="text-xs text-slate-500">{slot.id}</div>
                  </div>
                  <div className="font-bold text-indigo-600">RM {slot.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600">Total Amount</span>
              <span className="text-2xl font-bold text-slate-900">RM {selectedSlot.price.toFixed(2)}</span>
            </div>

            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {loading ? (
                <span>Redirecting to iPay88...</span>
              ) : (
                <>
                  <CreditCard size={20} />
                  Pay Now
                </>
              )}
            </button>
            <p className="text-xs text-center text-slate-400 mt-4">
              Secured by iPay88 OPSG v1.6.4.4
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}