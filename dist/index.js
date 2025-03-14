import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "frog/jsx/jsx-runtime";
import { serveStatic } from "@hono/node-server/serve-static";
import { Button, Frog } from "frog";
import { neynar } from "frog/middlewares";
import { serve } from "@hono/node-server";
import dotenv from "dotenv";
// بارگذاری متغیرهای محیطی از فایل .env
dotenv.config();
// بررسی کلید API
const AIRSTACK_API_KEY = process.env.AIRSTACK_API_KEY;
if (!AIRSTACK_API_KEY) {
    console.error("AIRSTACK_API_KEY is not defined in the environment variables");
    throw new Error("AIRSTACK_API_KEY is missing");
}
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
if (!NEYNAR_API_KEY) {
    console.error("NEYNAR_API_KEY is not defined in the environment variables");
    throw new Error("NEYNAR_API_KEY is missing");
}
// تعریف تابع برای تولید هش منحصر به فرد
function generateHashId(fid) {
    const timestamp = Date.now(); // زمان فعلی
    const randomHash = Math.random().toString(36).substr(2, 9); // تولید یک رشته تصادفی
    return `${timestamp}-${fid}-${randomHash}`; // ساخت هش منحصر به فرد
}
// تعریف اپلیکیشن Frog
export const app = new Frog({
    title: "Degen State",
    imageAspectRatio: "1:1",
    imageOptions: {
        fonts: [
            {
                name: "Lilita One",
                weight: 400,
                source: "google", // بارگذاری فونت از Google Fonts
            },
            {
                name: "Poppins",
                weight: 400,
                source: "google", // بارگذاری فونت از Google Fonts
            },
        ],
    },
    hub: {
        apiUrl: "https://hubs.airstack.xyz",
        fetchOptions: {
            headers: {
                "x-airstack-hubs": AIRSTACK_API_KEY, // استفاده از کلید API
            },
        },
    },
});
// افزودن میدلور neynar به اپلیکیشن Frog
app.use(neynar({
    apiKey: "NEYNAR_FROG_FM", // کلید API برای Neynar
    features: ["interactor", "cast"], // فعال کردن ویژگی‌ها
}));
app.use("/*", serveStatic({ root: "./public" }));
// درخواست اطلاعات از API Points
async function fetchUserPoints(fid, season = "current") {
    const apiUrl = `https://api.degen.tips/airdrop2/${season}/points?fid=${fid.toString()}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        console.log(`User Points Data for FID ${fid}:`, data);
        return data;
    }
    catch (error) {
        console.error("Error fetching user points:", error);
        return null;
    }
}
// درخواست اطلاعات از API Allowances
async function fetchUserAllowances(fid) {
    const apiUrl = `https://api.degen.tips/airdrop2/allowances?fid=${fid.toString()}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        console.log("Fetched Points Data:", JSON.stringify(data, null, 2));
        // مرتب‌سازی داده‌ها بر اساس تاریخ (به صورت نزولی)
        const sortedData = data.sort((a, b) => new Date(b.snapshot_day).getTime() - new Date(a.snapshot_day).getTime());
        // انتخاب روز آخر
        const lastDay = sortedData[0];
        if (lastDay) {
            console.log(`Last Allowances for FID ${fid}:`, `Date: ${lastDay.snapshot_day}, Tip Allowance: ${lastDay.tip_allowance}, Remaining Tip Allowance: ${lastDay.remaining_tip_allowance}`);
            console.log("Last Snapshot Date:", sortedData[0]?.snapshot_day);
        }
        return lastDay; // بازگشت روز آخر
    }
    catch (error) {
        console.error("Error fetching user allowances:", error);
        return null;
    }
}
async function fetchTodayTippedUsersWithUsernames(fid, maxUsers = 6) {
    const apiUrl = `https://api.degen.tips/airdrop2/tips?fid=${fid.toString()}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        console.log("Fetched Data:", data); // چاپ داده‌های دریافتی
        const todayDate = new Date().toISOString().split("T")[0];
        console.log("Today Date:", todayDate);
        // فیلتر کاربران برای روز جاری
        const todayTips = data.filter((tip) => {
            const tipDate = new Date(tip.snapshot_day).toISOString().split("T")[0];
            return tipDate === todayDate;
        });
        console.log("Filtered Today Tips:", todayTips);
        // پردازش کاربران برای دریافت یوزرنیم‌ها
        const processedUsers = await Promise.all(todayTips.map(async (tip) => {
            console.log(`Fetching username for recipient FID: ${tip.recipient_fid}`);
            const username = await fetchUsernameByFid(tip.recipient_fid); // دریافت یوزرنیم با API Warpcast
            console.log(`Fetched username: ${username}`);
            return {
                fid: tip.recipient_fid,
                username: username || "Unknown",
                tippedAmount: tip.tip_amount,
                tipCount: tip.tip_count || 1,
                totalTipped: tip.total_tipped || tip.tip_amount,
            };
        }));
        // مرتب‌سازی بر اساس `totalTipped` (بیشترین به کمترین)
        processedUsers
            .sort((a, b) => b.totalTipped - a.totalTipped)
            .slice(0, maxUsers)
            .forEach((user, index) => {
            console.log(`User ${index + 1}: ${user.username}, Total Tipped: ${user.totalTipped}`);
        });
        // محدود کردن به حداکثر `maxUsers` کاربر
        const limitedUsers = processedUsers.slice(0, maxUsers);
        // چاپ کاربران در ترمینال
        console.log("Top Tipped Users:");
        limitedUsers.forEach((user, index) => {
            console.log(`${index + 1}. Username: ${user.username}, Total Tipped: ${user.totalTipped}, Tip Count: ${user.tipCount}`);
        });
        return limitedUsers;
    }
    catch (error) {
        console.error("Error fetching today's tipped users with usernames:", error);
        return [];
    }
}
async function fetchUsernameByFid(fid) {
    const apiUrl = `https://api.warpcast.com/v2/user?fid=${fid}`;
    try {
        const response = await fetch(apiUrl, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            console.error(`Warpcast API Error for FID ${fid}: ${response.status} ${response.statusText}`);
            const errorData = await response.json();
            console.error("Error details:", JSON.stringify(errorData, null, 2));
            return null;
        }
        const data = await response.json();
        console.log(`Full response for FID ${fid}:`, JSON.stringify(data, null, 2));
        // استخراج username از مسیر صحیح
        const username = data?.result?.user?.username || null;
        if (username) {
            console.log(`Username for FID ${fid}: ${username}`);
        }
        else {
            console.warn(`No username found for FID ${fid}`);
        }
        return username;
    }
    catch (error) {
        console.error(`Error fetching username for FID ${fid}:`, error);
        return null;
    }
}
const hashIdCache = {}; // کش ساده برای تست
async function getOrGenerateHashId(fid) {
    if (hashIdCache[fid]) {
        return hashIdCache[fid];
    }
    const newHashId = generateHashId(fid);
    hashIdCache[fid] = newHashId;
    return newHashId;
}
// نمایش تنها صفحه دوم
app.frame("/", async (c) => {
    const interactor = c.var.interactor;
    const urlParams = new URLSearchParams(c.req.url.split('?')[1]);
    // دریافت اطلاعات از URL یا Interactor
    const fid = urlParams.get("fid") || interactor?.fid || "?";
    const username = urlParams.get("username") || interactor?.username || "?";
    const pfpUrl = urlParams.get("pfpUrl") || interactor?.pfpUrl || "";
    // تولید hashid یکتا
    const hashId = await getOrGenerateHashId(fid);
    // دریافت اطلاعات مرتبط با کاربر
    const todayTippedUsers = await fetchTodayTippedUsersWithUsernames(fid);
    let points = null;
    let lastTipAllowance = null;
    // پردازش اطلاعات Points
    if (fid !== "??") {
        const pointsData = await fetchUserPoints(fid);
        if (Array.isArray(pointsData) && pointsData.length > 0) {
            points = pointsData[0].points;
        }
        else {
            points = "0";
        }
        const lastAllowance = await fetchUserAllowances(fid);
        if (lastAllowance) {
            const tipAllowance = parseFloat(lastAllowance.tip_allowance) || 0;
            const remainingTipAllowance = parseFloat(lastAllowance.remaining_tip_allowance) || 0;
            const tipped = Math.round(tipAllowance - remainingTipAllowance);
            lastTipAllowance = {
                date: lastAllowance.snapshot_day,
                tip_allowance: lastAllowance.tip_allowance,
                remaining_tip_allowance: lastAllowance.remaining_tip_allowance,
                tipped: tipped.toString(),
            };
        }
    }
    // آماده‌سازی داده‌های محلی
    const localData = {
        fid,
        username,
        pfpUrl,
        hashId,
        points,
        lastTipAllowance,
        todayTippedUsers,
    };
    // ساخت URL‌های صفحه و اشتراک‌گذاری
    const tippedUsersData = todayTippedUsers
        .map((user) => `fid=${user.fid}&username=${user.username}&tippedAmount=${user.tippedAmount}`)
        .join("&");
    const page2Url = `https://81d3-79-127-240-41.ngrok-free.app/?fid=${encodeURIComponent(fid)}&username=${encodeURIComponent(username)}&pfpUrl=${encodeURIComponent(pfpUrl)}&${tippedUsersData}`;
    const longComposeCastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent("Check Your Degen State\n\nFrame By @jeyloo.eth")}&embeds[]=${encodeURIComponent(`https://81d3-79-127-240-41.ngrok-free.app/?hashid=${hashId}&fid=${fid}&username=${encodeURIComponent(username)}&pfpUrl=${encodeURIComponent(pfpUrl)}`)}`;
    // بررسی URL برای تشخیص حالت Embed
    const isEmbed = c.req.url.includes("/~/compose");
    // چاپ اطلاعات برای بررسی (اختیاری)
    console.log("Local Data for User:", JSON.stringify(localData, null, 2));
    console.log("Generated Cast URL:", longComposeCastUrl);
    console.log("Shared Page2 URL:", page2Url);
    console.log("Username:", username);
    console.log("Profile Picture URL:", pfpUrl);
    // دکمه‌های نمایش داده‌شده بر اساس Embed بودن یا نبودن
    const intents = isEmbed
        ? [
            _jsx(Button.Link, { href: "https://warpcast.com/jeyloo", children: "Tip Me" }),
        ]
        : [
            _jsx(Button, { value: "page2", children: "My State" }),
            _jsx(Button.Link, { href: longComposeCastUrl, children: "Share" }),
            _jsx(Button.Link, { href: "https://warpcast.com/jeyloo", children: "Tip Me" }),
        ];
    // بازگشت پاسخ
    return c.res({
        image: (_jsxs("div", { style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "100%",
                backgroundColor: "black",
                color: "white",
                fontSize: "20px",
                fontFamily: "'Lilita One','Poppins'",
            }, children: [_jsx("img", { src: "https://i.imgur.com/6975Rof.png", alt: "Degen State - Page 2", style: {
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        zIndex: 1,
                        position: "relative",
                    } }), _jsx("div", { style: {
                        position: "absolute",
                        top: "74%",
                        left: "56%",
                        transform: "translate(-50%, -50%)",
                        justifyContent: "flex-start",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        width: "550px",
                    }, children: todayTippedUsers.slice(0, 6).map((user, index) => (_jsxs("div", { style: {
                            color: "#90caf9",
                            display: "flex",
                            justifyContent: "space-between",
                            width: "120%",
                            marginBottom: "3px",
                        }, children: [_jsx("span", { style: { flex: 1, textAlign: "center" }, children: user.fid }), _jsx("span", { style: { flex: 1, textAlign: "center" }, children: user.username }), _jsx("span", { style: { flex: 1, textAlign: "center" }, children: user.tippedAmount })] }, index))) }), pfpUrl && (_jsx("img", { src: pfpUrl, alt: "Profile Picture", style: {
                        width: "150px",
                        height: "150px",
                        borderRadius: "50%",
                        position: "absolute",
                        top: "17%",
                        left: "32%",
                        transform: "translate(-50%, -50%)",
                        border: "3px solid white",
                    } })), _jsx("p", { style: {
                        color: "cyan",
                        fontSize: username.length > 5 ? "45px" : "50px",
                        fontWeight: "700",
                        position: "absolute",
                        top: "5%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                    }, children: username }), _jsx("p", { style: {
                        color: "white",
                        fontSize: "18px",
                        fontWeight: "500",
                        position: "absolute",
                        top: "14.3%",
                        left: "46.5%",
                        transform: "translate(-50%, -50%)",
                    }, children: fid }), _jsx("p", { style: {
                        color: "white",
                        fontSize: "50px",
                        fontWeight: "1100",
                        position: "absolute",
                        top: "28%",
                        left: "55%",
                        transform: "translate(-50%, -50%) rotate(-15deg)",
                    }, children: points || "0" }), lastTipAllowance && (_jsxs(_Fragment, { children: [_jsx("p", { style: {
                                color: "lightgreen",
                                fontSize: "35px",
                                fontWeight: "700",
                                position: "absolute",
                                top: "39%",
                                left: "31%",
                                transform: "translate(-50%, -50%)",
                            }, children: `${lastTipAllowance.tip_allowance}` }), _jsx("p", { style: {
                                color: "lime",
                                fontSize: "18px",
                                fontWeight: "50",
                                position: "absolute",
                                top: "49.5%",
                                left: "30%",
                                transform: "translate(-50%, -50%)",
                            }, children: `${lastTipAllowance.remaining_tip_allowance}` }), _jsx("p", { style: {
                                color: "red",
                                fontSize: "18px",
                                fontWeight: "100",
                                position: "absolute",
                                top: "49.5%",
                                left: "70.5%",
                                transform: "translate(-50%, -50%)",
                            }, children: `${lastTipAllowance.tipped}` })] }))] })),
        intents,
    });
});
const port = process.env.PORT || 3000;
// اطمینان از استفاده صحیح از عدد به عنوان پورت
serve(app);
console.log(`Server is running on port ${port}`);
