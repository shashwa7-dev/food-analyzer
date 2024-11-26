import PokedexUI from "./components/PokedexUI";

export default function Home() {
  return (
    <div className="h-screen grid place-items-center p-2">
      <PokedexUI />
      <div className="w-[100px] h-[100px] opacity-30 fixed bottom-2  right-2 -z-1 rounded-full overflow-hidden border-4">
        <img src={"/s7dev.png"} alt="" className="w-full h-full" />
      </div>
      <div className="w-full h-full opacity-10 blur-sm fixed left-0  bottom-0  -z-10 overflow-hidden">
        <img
          src={"/bg.png"}
          alt=""
          className="w-full h-full object-cover object-center "
        />
      </div>
    </div>
  );
}
