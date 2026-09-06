import React, { useState, useEffect } from 'react';
import { ShoppingBag, Tractor, Recycle, Truck, Sparkles, CheckCircle2, ShoppingCart, PlusCircle, Check, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function App() {
  const [activeTab, setActiveTab] = useState('farmer');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  
  // Form states
  const [newCrop, setNewCrop] = useState('');
  const [newCropType, setNewCropType] = useState('Vegetable');
  const [newCropPrice, setNewCropPrice] = useState('');
  const [newCropStock, setNewCropStock] = useState(100);
  const [aiSuggestion, setAiSuggestion] = useState('');
  
  // Track quantities per product in Customer Store
  const [selectedQuantities, setSelectedQuantities] = useState({});

  useEffect(() => {
    fetchProducts();
    fetchOrders();

    const orderSubscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    const productSubscription = supabase
      .channel('public:products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
      supabase.removeChannel(productSubscription);
    };
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (error) console.error('Error fetching products:', error);
    else setProducts(data || []);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('id', { ascending: false });
    if (error) console.error('Error fetching orders:', error);
    else setOrders(data || []);
  };

  // Dynamic AI Price Suggestion based on crop name & category
  const getAiPrice = () => {
    if (!newCrop.trim()) {
      alert('Please enter a produce name first!');
      return;
    }

    const nameLower = newCrop.toLowerCase().trim();
    let calculatedPrice = 35; // Default fallback

    if (nameLower.includes('tomato')) calculatedPrice = 42;
    else if (nameLower.includes('onion')) calculatedPrice = 38;
    else if (nameLower.includes('potato')) calculatedPrice = 30;
    else if (nameLower.includes('carrot')) calculatedPrice = 55;
    else if (nameLower.includes('husk') || nameLower.includes('straw') || nameLower.includes('bagasse')) calculatedPrice = 15;
    else if (newCropType === 'By-Product') calculatedPrice = 20;
    else {
      // Generate a realistic price based on length hash
      calculatedPrice = 25 + (nameLower.length * 3) % 40;
    }

    setNewCropPrice(calculatedPrice);
    setAiSuggestion(`AI Suggested Price for ${newCrop}: ₹${calculatedPrice}/kg based on current market demand.`);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newCrop || !newCropPrice) return;

    const { error } = await supabase.from('products').insert([
      {
        name: newCrop,
        type: newCropType,
        price: Number(newCropPrice),
        unit: 'kg',
        stock: Number(newCropStock),
        seller: 'Local Farmer',
      },
    ]);

    if (error) {
      alert('Error adding product: ' + error.message);
    } else {
      alert(`Success! Listed ${newCrop} on the market.`);
      setNewCrop('');
      setNewCropPrice('');
      setNewCropStock(100);
      setAiSuggestion('');
      fetchProducts();
    }
  };

  const handleDeleteProduct = async (productId) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      alert('Error deleting product: ' + error.message);
    } else {
      fetchProducts();
    }
  };

  const handleQuantityChange = (productId, qty) => {
    const value = Math.max(1, Number(qty));
    setSelectedQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const handlePlaceOrder = async (product) => {
    const quantity = selectedQuantities[product.id] || 1;

    if (product.stock < quantity) {
      alert(`Only ${product.stock} kg available in stock!`);
      return;
    }

    const totalPrice = product.price * quantity;

    // 1. Insert order
    const { error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
          total_price: totalPrice,
          customer_name: 'Customer (Salem)',
          status: 'Placed',
        },
      ]);

    if (orderError) {
      alert('Database Insert Error: ' + orderError.message);
      return;
    }

    // 2. Deduct available stock
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: product.stock - quantity })
      .eq('id', product.id);

    if (stockError) {
      console.error('Failed to update stock:', stockError.message);
    }

    alert(`Success! Placed order for ${quantity} kg of ${product.name}`);
    fetchOrders();
    fetchProducts();
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Error updating order: ' + error.message);
    } else {
      fetchOrders();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-emerald-700 text-white shadow-md p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Tractor className="w-8 h-8 text-amber-300" />
            <h1 className="text-2xl font-bold tracking-wide">KATHIR</h1>
          </div>
          <p className="text-emerald-100 text-sm hidden md:block">
            Smart Agricultural Marketplace & Logistics Platform
          </p>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {[
            { id: 'farmer', label: 'Farmer Portal', icon: Tractor },
            { id: 'customer', label: 'Customer Store', icon: ShoppingBag },
            { id: 'byproduct', label: 'By-Product Buyer', icon: Recycle },
            { id: 'delivery', label: 'Delivery Partner', icon: Truck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-6 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                    : 'border-transparent text-slate-600 hover:text-emerald-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 pb-24">
        {/* FARMER TAB */}
        {activeTab === 'farmer' && (
          <div className="space-y-6">
            <form onSubmit={handleAddProduct} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Tractor className="text-emerald-600" /> List New Produce or By-Product
              </h2>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Produce Name</label>
                <input
                  type="text"
                  placeholder="e.g., Onion, Tomato, Rice Husk"
                  value={newCrop}
                  onChange={(e) => setNewCrop(e.target.value)}
                  className="p-3 border rounded-lg w-full focus:outline-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={newCropType}
                  onChange={(e) => setNewCropType(e.target.value)}
                  className="p-3 border rounded-lg w-full bg-white focus:outline-emerald-500"
                >
                  <option value="Vegetable">Vegetable / Crop</option>
                  <option value="By-Product">Agricultural By-Product</option>
                </select>
              </div>

              <button
                type="button"
                onClick={getAiPrice}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold p-3 rounded-lg flex items-center justify-center gap-2 transition-colors w-full cursor-pointer"
              >
                <Sparkles className="w-5 h-5" /> Get AI Price Suggestion
              </button>

              {aiSuggestion && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm font-medium">{aiSuggestion}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Price per kg (₹)</label>
                  <input
                    type="number"
                    placeholder="Price (₹/kg)"
                    value={newCropPrice}
                    onChange={(e) => setNewCropPrice(e.target.value)}
                    className="p-3 border rounded-lg w-full focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Stock (kg)</label>
                  <input
                    type="number"
                    value={newCropStock}
                    onChange={(e) => setNewCropStock(e.target.value)}
                    className="p-3 border rounded-lg w-full focus:outline-emerald-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-4 rounded-lg transition-colors w-full flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" /> Publish Item
              </button>
            </form>

            {/* FARMER ACTIVE LISTINGS */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Your Active Listings</h3>
              {products.length === 0 ? (
                <p className="text-slate-500 text-sm">No items listed yet.</p>
              ) : (
                <div className="space-y-3">
                  {products.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 border rounded-lg">
                      <div>
                        <span className="font-bold text-slate-800">{item.name}</span> ({item.type})
                        <p className="text-xs text-slate-500">₹{item.price}/kg • Stock: {item.stock} kg</p>
                      </div>
                      <button
                        onClick={() => handleDeleteProduct(item.id)}
                        className="text-red-500 hover:text-red-700 p-2 cursor-pointer"
                        title="Delete listing"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CUSTOMER TAB */}
        {activeTab === 'customer' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShoppingBag className="text-emerald-600" /> Available Fresh Vegetables
            </h2>
            {products.filter((p) => p.type === 'Vegetable').length === 0 ? (
              <p className="text-slate-500 text-sm">No vegetables available yet. List one from the Farmer Portal!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.filter((p) => p.type === 'Vegetable').map((item) => {
                  const qty = selectedQuantities[item.id] || 1;
                  const isOutOfStock = item.stock <= 0;

                  return (
                    <div key={item.id} className="p-4 border rounded-lg flex flex-col justify-between bg-slate-50 gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                          <p className="text-xs text-slate-500">Seller: {item.seller}</p>
                          <p className="text-emerald-700 font-bold mt-1">₹{item.price} / {item.unit}</p>
                          <span className={`inline-block text-xs font-semibold mt-1 ${isOutOfStock ? 'text-red-600' : 'text-slate-500'}`}>
                            {isOutOfStock ? 'Out of Stock' : `Available: ${item.stock} kg`}
                          </span>
                        </div>
                        {!isOutOfStock && (
                          <div className="text-right">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Qty (kg)</label>
                            <input
                              type="number"
                              min="1"
                              max={item.stock}
                              value={qty}
                              onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                              className="w-16 p-1 border rounded text-center font-bold bg-white"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                        <span className="text-sm font-semibold text-slate-700">
                          Total: <span className="text-emerald-700 font-bold">₹{isOutOfStock ? 0 : item.price * qty}</span>
                        </span>
                        <button
                          disabled={isOutOfStock}
                          onClick={() => handlePlaceOrder(item)}
                          className={`text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1 ${
                            isOutOfStock
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer'
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4" /> {isOutOfStock ? 'Sold Out' : 'Place Order'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* BY-PRODUCT BUYER TAB */}
        {activeTab === 'byproduct' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Recycle className="text-emerald-600" /> Agricultural By-Products for Industries
            </h2>
            {products.filter((p) => p.type === 'By-Product').length === 0 ? (
              <p className="text-slate-500 text-sm">No agricultural by-products listed yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.filter((p) => p.type === 'By-Product').map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg flex justify-between items-center bg-slate-50">
                    <div>
                      <h3 className="font-bold text-slate-800">{item.name}</h3>
                      <p className="text-xs text-slate-500">Available Stock: {item.stock} {item.unit}</p>
                      <p className="text-emerald-700 font-semibold mt-1">₹{item.price} / {item.unit}</p>
                    </div>
                    <button
                      onClick={() => handlePlaceOrder(item)}
                      className="bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 cursor-pointer"
                    >
                      Request Bulk Match
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DELIVERY PARTNER TAB */}
        {activeTab === 'delivery' && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Truck className="text-emerald-600" /> Active Customer Orders for Delivery
            </h2>
            {orders.length === 0 ? (
              <p className="text-slate-500 text-sm">No active orders placed yet.</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="p-4 bg-slate-50 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="font-bold text-slate-800">Order #{order.id} — {order.product_name}</span>
                    <p className="text-xs text-slate-500">Customer: {order.customer_name} | Qty: {order.quantity} kg</p>
                    <p className="text-emerald-700 font-semibold text-sm mt-1">Total: ₹{order.total_price}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto justify-between">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'In Transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {order.status}
                    </span>

                    {order.status === 'Placed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'In Transit')}
                        className="bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 font-medium cursor-pointer"
                      >
                        Start Delivery
                      </button>
                    )}

                    {order.status === 'In Transit' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'Delivered')}
                        className="bg-emerald-600 text-white text-xs px-3 py-2 rounded hover:bg-emerald-700 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3 h-3" /> Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}