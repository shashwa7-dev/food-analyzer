import PokedexUI from "./components/PokedexUI";

export default function Home() {
  return (
    <div className="h-screen grid place-items-center p-2">
      <PokedexUI />
      <div className="w-[100px] h-[100px] opacity-30 fixed bottom-2  right-2 -z-1 rounded-full overflow-hidden border-4">
        <img src={"/s7dev.png"} alt="" className="w-full h-full" />
      </div>
    </div>
  );
}
