import styles from "@/app/ui/home/home.module.css";
import Image from "next/image";

export default function Page() {
  return (
    // must always return a root!
    <div>
      <h1>SmartQueue</h1>
      <p>Avoid the line, join the queue.</p>
      <Image
        src="/logo.png"
        width={500}
        height={500}
        alt="Logo of SmartQueue"
      />
    </div>
  );
}
