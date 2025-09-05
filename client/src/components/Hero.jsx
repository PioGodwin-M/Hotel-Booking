import React from 'react'
import { assets, cities } from '../assets/assets'
import { useAppContext } from '../context/AppContext'
const Hero = () => {
    const [destination,setDestination]=React.useState('');
    const {axios,navigate,getToken,setSearchedCities}=useAppContext();
    const onSearch=async(e)=>{
        e.preventDefault();
        try{
           const res = await axios.get(`/api/rooms?city=${destination}`);
const data = res.data; // extract the payload

if (data.success) {
  navigate(`/rooms?destination=${destination}`);

  const token = await getToken();
  await axios.post(
    '/api/user/recent-searched-cities',
    { destination },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setSearchedCities((prevCities) => {
    const updatedCities = [
      destination,
      ...prevCities.filter((city) => city !== destination),
    ];
    if (updatedCities.length > 3) {
      updatedCities.pop(); // remove oldest if > 3
    }
    return updatedCities;
  });
}

        }
        catch(error){
            console.log(error);
        }
    }
  return (
    <div className='flex flex-col items-start justify-center px-6 md:px-16 lg:px-24 xl:px-32 text-white bg-[url("/src/assets/heroImage.png")] bg-no-repeat bg-cover bg-center h-screen'>
      <p className='bg-[#49B9FF]/50 px-3.5 py-1 rounded-full mt-20'>The Ultimate Hotel Experience</p>
      <h1 className='font-playfair text-2xl md:text-5xl md:leading-[56px] font-bold md:font-extrabold max-w-xl mt-4'>Discover Your Perfect GateWay Destination</h1>
      <p className='max-w-[310] mt-2 text-sm md:text-base'>Unparalleled luxury and comfort await at the worlds most exclusive hotels and resorts. Start your journey today.</p>
      

    
        <form onSubmit={onSearch} className='bg-white text-gray-500 rounded-lg px-6 py-4 mt-8 flex flex-col md:flex-row max-md:items-start gap-4 max-md:mx-auto'>

            <div>
                <div className='flex items-center gap-2'>
                   <img src={assets.calenderIcon} alt="Calender-icon" className='h-4'></img>
                    <label htmlFor="destinationInput">Destination</label>
                </div>
                <input onChange={e=> setDestination(e.target.value)} value={destination} list='destinations' id="destinationInput" type="text" className=" rounded border border-gray-200 px-3 py-1.5 mt-1.5 text-sm outline-none" placeholder="Type here" required />
                <datalist id="destinations">
                        {cities.map((city,index)=>( 
                            <option value={city} key={index}></option>
                        ))}
                </datalist>
            </div>

            <div>
                <div className='flex items-center gap-2'>
                   <img src={assets.calenderIcon} alt="Calender-icon" className='h-4'/>
                    <label htmlFor="checkIn">Check in</label>
                </div>
                <input id="checkIn" type="date" className=" rounded border border-gray-200 px-3 py-1.5 mt-1.5 text-sm outline-none" />
            </div>

            <div>
                <div className='flex items-center gap-2'>
                   <img src={assets.calenderIcon} alt="Calender-icon" className='h-4'/>
                    <label htmlFor="checkOut">Check out</label>
                </div>
                <input id="checkOut" type="date" className=" rounded border border-gray-200 px-3 py-1.5 mt-1.5 text-sm outline-none" />
            </div>

 

            <button className='flex items-center justify-center gap-1 rounded-md bg-black py-3 px-4 text-white my-auto cursor-pointer max-md:w-full max-md:py-1' >
               <img src={assets.searchIcon} alt="Search-icon" className='h-7'/>
                <span>Search</span>
            </button>
        </form>
    

    </div>
  )
}

export default Hero
