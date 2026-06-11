declare name "Lowpass";
declare description "Second-order stereo lowpass filter with adjustable cutoff";
import("stdfaust.lib");

cutoff = hslider("cutoff [unit:Hz] [scale:log]", 1000, 20, 20000, 1);

process = fi.lowpass(2, cutoff), fi.lowpass(2, cutoff);
