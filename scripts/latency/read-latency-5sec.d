BEGIN {
	printf("tracing for 5 seconds\n");
}

syscall::read:entry
{
	self->ts = timestamp;
}

syscall::read:return
/self->ts/
{
	@[execname, "ns"] = quantize(timestamp - self->ts);
	self->ts = 0;
}

tick-5sec
{
	exit(0);
}
