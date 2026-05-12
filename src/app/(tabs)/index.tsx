import { Image } from "expo-image";
import { Link } from "expo-router";
import { Platform, Text, View } from "react-native";
import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          className="absolute bottom-0 left-0 h-[178px] w-[290px]"
        />
      }
    >
      <View className="flex-row items-center gap-2">
        <Text className="font-bold text-3xl text-foreground leading-8">
          Welcome!
        </Text>
        <HelloWave />
      </View>
      <View className="my-4 rounded-xl bg-slate-800 p-4">
        <Text className="text-center font-bold text-blue-400 text-xl">
          NativeWind is configured! 🚀
        </Text>
      </View>
      <View className="mb-2 gap-2">
        <Text className="font-bold text-foreground text-xl">
          Step 1: Try it
        </Text>
        <Text className="text-base text-foreground leading-6">
          Edit{" "}
          <Text className="font-semibold text-base text-foreground leading-6">
            app/(tabs)/index.tsx
          </Text>{" "}
          to see changes. Press{" "}
          <Text className="font-semibold text-base text-foreground leading-6">
            {Platform.select({
              ios: "cmd + d",
              android: "cmd + m",
              web: "F12",
            })}
          </Text>{" "}
          to open developer tools.
        </Text>
      </View>
      <View className="mb-2 gap-2">
        <Link href="/modal">
          <Link.Trigger>
            <Text className="font-bold text-foreground text-xl">
              Step 2: Explore
            </Text>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction
              title="Action"
              icon="cube"
              onPress={() => alert("Action pressed")}
            />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert("Share pressed")}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert("Delete pressed")}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <Text className="text-base text-foreground leading-6">
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </Text>
      </View>
      <View className="mb-2 gap-2">
        <Text className="font-bold text-foreground text-xl">
          Step 3: Get a fresh start
        </Text>
        <Text className="text-base text-foreground leading-6">
          {`When you're ready, run `}
          <Text className="font-semibold text-base text-foreground leading-6">
            npm run reset-project
          </Text>{" "}
          to get a fresh{" "}
          <Text className="font-semibold text-base text-foreground leading-6">
            app
          </Text>{" "}
          directory. This will move the current{" "}
          <Text className="font-semibold text-base text-foreground leading-6">
            app
          </Text>{" "}
          to{" "}
          <Text className="font-semibold text-base text-foreground leading-6">
            app-example
          </Text>
          .
        </Text>
      </View>
    </ParallaxScrollView>
  );
}
