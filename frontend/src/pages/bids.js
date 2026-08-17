import React, { useState } from 'react';
// import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Bids = ({ setIsAuthenticated }) => {
  const [showContactForm, setShowContactForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTaluka, setSelectedTaluka] = useState('');
  const [addressline1, setAddressLine1] = useState('');
  const [pincode, setPincode] = useState('');
  const [orderItems, setOrderItems] = useState([]);

  const locationData = {
    Maharashtra: {
      Pune: {
        Hinjewadi: '411057',
        Wakad: '411057',
      },
      Mumbai: {
        Andheri: '400053',
        Borivali: '400066',
      },
      Satara: {
        Satara: '415001',
        Sadarbazar: '415002',
      },
    },
  };

  const handleStateChange = (e) => {
    const state = e.target.value;
    setSelectedState(state);
    setSelectedDistrict('');
    setSelectedTaluka('');
  };

  const handleDistrictChange = (e) => {
    const district = e.target.value;
    setSelectedDistrict(district);
    setSelectedTaluka('');
  };

  const handleTalukaChange = (e) => {
    const taluka = e.target.value;
    setSelectedTaluka(taluka);
  };

  const handleContactFormSubmit = async (e) => {
    e.preventDefault();
    const fullAddress = `${addressline1}, ${selectedTaluka}, ${selectedDistrict}, ${selectedState}, India - ${pincode}`;
    const data = {
      businessName,
      ownerName,
      contactNumber,
      email,
      businessCategory,
      address: fullAddress,
      state: selectedState,
      district: selectedDistrict,
      taluka: selectedTaluka,
      pincode,
    };

    try {
      const apiBaseUrl = process.env.REACT_APP_API_URL;
      console.log(
        'Submitting contact form to:',
        `${apiBaseUrl}/api/contact/submit`,
      );
      const res = await fetch(`${apiBaseUrl}/api/contact/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      alert(result.message);
      resetContactForm();
      setShowContactForm(false);
    } catch (err) {
      console.error('Error submitting contact form:', err);
      alert('Failed to submit contact form');
    }
  };

  const handleOrderFormSubmit = async (e) => {
    e.preventDefault();
    const fullAddress = `${addressline1}, ${selectedTaluka}, ${selectedDistrict}, ${selectedState}, India - ${pincode}`;
    const data = {
      businessName,
      ownerName,
      contactNumber,
      email,
      deliveryAddress: fullAddress,
      state: selectedState,
      district: selectedDistrict,
      taluka: selectedTaluka,
      pincode,
      items: orderItems,
    };

    try {
      const apiBaseUrl = process.env.REACT_APP_API_URL;
      console.log('Submitting order form to:', `${apiBaseUrl}/submit`);
      const res = await fetch(`${apiBaseUrl}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const result = await res.json();
      alert(result.message);
      resetOrderForm();
      setShowOrderForm(false);
    } catch (err) {
      console.error('Error submitting order form:', err);
      alert('Failed to submit order form');
    }
  };

  const resetContactForm = () => {
    setBusinessName('');
    setOwnerName('');
    setContactNumber('');
    setEmail('');
    setBusinessCategory('');
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedTaluka('');
    setPincode('');
    setAddressLine1('');
  };

  const resetOrderForm = () => {
    setBusinessName('');
    setOwnerName('');
    setContactNumber('');
    setEmail('');
    setOrderItems([]);
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedTaluka('');
    setPincode('');
    setAddressLine1('');
  };

  return (
    <div className='app-container'>
      <div className='work-shell'>
        <Sidebar setIsAuthenticated={setIsAuthenticated} />
        <main className='work-page'>
          <h2>Bids</h2>
          <div className='sections-container'>
            <div className='current-section'>
              <h3>Contact Form</h3>
              <button
                className='create-event-btn'
                onClick={() => setShowContactForm(!showContactForm)}
              >
                {showContactForm ? 'Hide Contact Form' : 'Show Contact Form'}
              </button>
              {showContactForm && (
                <div className='form-wrapper'>
                  <form
                    onSubmit={handleContactFormSubmit}
                    className='contact-form-container'
                  >
                    <h3>Contact Form</h3>
                    <div className='form-group'>
                      <label>Business Name</label>
                      <input
                        type='text'
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>Owner Name</label>
                      <input
                        type='text'
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>Contact Number</label>
                      <input
                        type='tel'
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>Email ID</label>
                      <input
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className='form-group'>
                      <label>Business Category</label>
                      <select
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        required
                      >
                        <option value=''>Select Category</option>
                        <option value='Electronics'>Electronics</option>
                        <option value='Clothing'>Clothing</option>
                        <option value='Food & Beverage'>Food & Beverage</option>
                        <option value='Other'>Other</option>
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>Address</label>
                      <input
                        type='text'
                        value={addressline1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>State</label>
                      <select
                        value={selectedState}
                        onChange={handleStateChange}
                        required
                      >
                        <option value=''>Select State</option>
                        {Object.keys(locationData).map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>District</label>
                      <select
                        value={selectedDistrict}
                        onChange={handleDistrictChange}
                        disabled={!selectedState}
                        required
                      >
                        <option value=''>Select District</option>
                        {selectedState &&
                          Object.keys(locationData[selectedState]).map(
                            (district) => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ),
                          )}
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>Taluka</label>
                      <select
                        value={selectedTaluka}
                        onChange={handleTalukaChange}
                        disabled={!selectedDistrict}
                        required
                      >
                        <option value=''>Select Taluka</option>
                        {selectedDistrict &&
                          Object.keys(
                            locationData[selectedState][selectedDistrict],
                          ).map((taluka) => (
                            <option key={taluka} value={taluka}>
                              {taluka}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>Pincode</label>
                      <input
                        type='text'
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        required
                      />
                    </div>
                    <button type='submit' className='btn-primary'>
                      Submit
                    </button>
                  </form>
                </div>
              )}
            </div>
            <div className='create-section'>
              <h3>Order Form</h3>
              <button
                className='create-event-btn'
                onClick={() => setShowOrderForm(!showOrderForm)}
              >
                {showOrderForm ? 'Hide Order Form' : 'Show Order Form'}
              </button>
              {showOrderForm && (
                <div className='form-wrapper'>
                  <form
                    onSubmit={handleOrderFormSubmit}
                    className='order-form-container'
                  >
                    <h3>Order Form</h3>
                    <div className='form-group'>
                      <label>Business Name</label>
                      <input
                        type='text'
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>Owner Name</label>
                      <input
                        type='text'
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>Contact Number</label>
                      <input
                        type='tel'
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>Email ID</label>
                      <input
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className='form-group'>
                      <label>Quantity</label>
                      <table>
                        <thead>
                          <tr>
                            <th>Weight</th>
                            <th>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            '100g',
                            '200g',
                            '250g',
                            '500g',
                            '1kg',
                            '5kg',
                            '10kg',
                          ].map((weightOption) => (
                            <tr key={weightOption}>
                              <td>{weightOption}</td>
                              <td>
                                <input
                                  type='number'
                                  min='0'
                                  value={
                                    orderItems.find(
                                      (item) => item.weight === weightOption,
                                    )?.quantity || 0
                                  }
                                  onChange={(e) => {
                                    const quantity = parseInt(
                                      e.target.value,
                                      10,
                                    );
                                    if (!isNaN(quantity)) {
                                      const updatedItems = [...orderItems];
                                      const existingItemIndex =
                                        updatedItems.findIndex(
                                          (item) =>
                                            item.weight === weightOption,
                                        );
                                      if (existingItemIndex >= 0) {
                                        if (quantity === 0) {
                                          updatedItems.splice(
                                            existingItemIndex,
                                            1,
                                          );
                                        } else {
                                          updatedItems[
                                            existingItemIndex
                                          ].quantity = quantity;
                                        }
                                      } else if (quantity > 0) {
                                        updatedItems.push({
                                          weight: weightOption,
                                          quantity,
                                        });
                                      }
                                      setOrderItems(updatedItems);
                                    }
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orderItems.length > 0 && (
                      <div
                        className='order-summary'
                        style={{ marginTop: '20px' }}
                      >
                        <h4>Selected Items</h4>
                        <ul>
                          {orderItems.map((item, index) => (
                            <li key={index}>
                              {item.quantity} × {item.weight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className='form-group'>
                      <label>Address</label>
                      <input
                        type='text'
                        value={addressline1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        required
                      />
                    </div>
                    <div className='form-group'>
                      <label>State</label>
                      <select
                        value={selectedState}
                        onChange={handleStateChange}
                        required
                      >
                        <option value=''>Select State</option>
                        {Object.keys(locationData).map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>District</label>
                      <select
                        value={selectedDistrict}
                        onChange={handleDistrictChange}
                        disabled={!selectedState}
                        required
                      >
                        <option value=''>Select District</option>
                        {selectedState &&
                          Object.keys(locationData[selectedState]).map(
                            (district) => (
                              <option key={district} value={district}>
                                {district}
                              </option>
                            ),
                          )}
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>Taluka</label>
                      <select
                        value={selectedTaluka}
                        onChange={handleTalukaChange}
                        disabled={!selectedDistrict}
                        required
                      >
                        <option value=''>Select Taluka</option>
                        {selectedDistrict &&
                          Object.keys(
                            locationData[selectedState][selectedDistrict],
                          ).map((taluka) => (
                            <option key={taluka} value={taluka}>
                              {taluka}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className='form-group'>
                      <label>Pincode</label>
                      <input
                        type='text'
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        required
                      />
                    </div>
                    <button type='submit' className='btn-primary'>
                      Submit
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Bids;
